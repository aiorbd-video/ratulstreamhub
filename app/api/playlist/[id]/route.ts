// ফাইল পাথ: app/api/playlist/[id]/route.ts
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    }
  });
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const userAgent = req.headers.get('user-agent')?.toLowerCase() || '';

    // 🚫 ব্রাউজার হ্যাকার ব্লক
    const isBrowser = userAgent.includes('mozilla') && 
                      (userAgent.includes('chrome') || userAgent.includes('safari') || userAgent.includes('firefox') || userAgent.includes('edge')) && 
                      !userAgent.includes('tv') && 
                      !userAgent.includes('smarters') && 
                      !userAgent.includes('iptv');

    if (isBrowser) {
      return new Response("🚫 Access Denied! This link is protected. You can only open this M3U playlist inside an IPTV Player.", { 
        status: 403, 
        headers: { "Content-Type": "text/plain", "Access-Control-Allow-Origin": "*" } 
      });
    }

    const client = await clientPromise;
    const db = client.db("all_in_one_reborn_db");

    let userId;
    try { userId = new ObjectId(params.id); } catch (e) {
      return new Response("#EXTM3U\n#EXTINF:-1, ❌ Invalid User ID\nhttp://error.local", { status: 400 });
    }

    const user = await db.collection("web_users").findOne({ _id: userId });

    if (!user || !user.isPremium || (user.premiumExpiry && new Date(user.premiumExpiry) < new Date())) {
      return new Response("#EXTM3U\n#EXTINF:-1, 🚫 Subscription Expired!\nhttp://expired.local", {
        headers: { "Content-Type": "application/vnd.apple.mpegurl", "Access-Control-Allow-Origin": "*" }
      });
    }

    // 🎯 ১. সব ডাটা এক জায়গায় আনা হচ্ছে (Raw Text Collection)
    let rawM3uText = "";

    const streams = await db.collection("posted_streams").find({}).toArray();
    streams.forEach(stream => {
      let rawTitle = (stream.title || "").replace(/tvg-[a-zA-Z0-9\-]+="[^"]*"/g, "").replace(/(https?:\/\/[^\s]+)/g, "").replace(/^[,-\s]+/, "").trim() || "Live TV";
      rawM3uText += `#EXTINF:-1 tvg-logo="${stream.logo || ''}" group-title="${stream.group || 'Live TV'}", ${rawTitle}\n`;
      if (stream.stream_url) {
        rawM3uText += `${stream.stream_url.trim()}\n`;
      }
    });

    const mergedM3uDoc = await db.collection("system_settings").findOne({ key: "merged_premium_m3u" });
    if (mergedM3uDoc && mergedM3uDoc.content) {
      rawM3uText += `${mergedM3uDoc.content}\n`;
    }

    // 🚀 ২. আল্টিমেট অটো-কনভার্টার (Pipe Format Generator)
    let m3uContent = "#EXTM3U x-tvg-url=\"\"\n";
    const lines = rawM3uText.split(/\r?\n/);
    
    let tempHeaders: any = {};
    let currentExtInf = "";

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i].trim();
      if (!line || line.startsWith('#EXTM3U')) continue;

      if (line.startsWith('#EXTINF')) {
        // যদি আগের কোনো #EXTINF থাকে যার লিংক পাওয়া যায়নি, সেটা প্রিন্ট করে ক্লিয়ার করা
        if (currentExtInf) m3uContent += `${currentExtInf}\n`;
        currentExtInf = line;
      } 
      else if (line.startsWith('#EXTVLCOPT:http-user-agent=')) {
        tempHeaders['User-Agent'] = line.substring(27).trim();
      } 
      else if (line.startsWith('#EXTVLCOPT:http-referer=') || line.startsWith('#EXTVLCOPT:http-referrer=')) {
        // 🎯 স্পেলিং মিসটেক ফিক্স: referrer (ডাবল r) এবং referer দুটোই কাজ করবে
        const prefixLen = line.indexOf('=') + 1;
        tempHeaders['Referer'] = line.substring(prefixLen).trim();
      } 
      else if (line.startsWith('#EXTHTTP:')) {
        // 🎯 JSON হেডার ফিক্স: Toffee বা অন্যান্য কুকি রিকোয়েস্ট
        try {
          let jsonStr = line.substring(9);
          let parsed = JSON.parse(jsonStr);
          if (parsed.cookie || parsed.Cookie) tempHeaders['Cookie'] = parsed.cookie || parsed.Cookie;
          if (parsed.Origin || parsed.origin) tempHeaders['Origin'] = parsed.Origin || parsed.origin;
          if (parsed.Referer || parsed.referer || parsed.referrer || parsed.Referrer) {
            tempHeaders['Referer'] = parsed.Referer || parsed.referer || parsed.referrer || parsed.Referrer;
          }
          if (parsed['User-Agent'] || parsed['user-agent']) {
            tempHeaders['User-Agent'] = parsed['User-Agent'] || parsed['user-agent'];
          }
        } catch(e){}
      } 
      else if (line.startsWith('http')) {
        let fullUrl = line.replace(/[\r\n\s]+/g, "").trim();

        // 🎯 ম্যাজিক: পাইপ জোড়া লাগানো হচ্ছে
        if (!fullUrl.includes('|') && Object.keys(tempHeaders).length > 0) {
          let pipeStr = "";
          for (const [key, val] of Object.entries(tempHeaders)) {
            pipeStr += `${pipeStr ? '&' : '|'}${key}=${val}`;
          }
          fullUrl += pipeStr;
        }

        if (currentExtInf) {
          m3uContent += `${currentExtInf}\n`;
          currentExtInf = ""; // প্রিন্ট করার পর রিসেট
        }
        m3uContent += `${fullUrl}\n`;
        tempHeaders = {}; // লিংক বসানোর পর টেম্পোরারি হেডার ক্লিয়ার
      } 
      else {
        // অন্য কোনো অজানা ট্যাগ থাকলে
        if (!line.startsWith('#EXTVLCOPT') && !line.startsWith('#EXTHTTP')) {
          if (currentExtInf) {
            m3uContent += `${currentExtInf}\n`;
            currentExtInf = "";
          }
          m3uContent += `${line}\n`;
        }
      }
    }

    // লুপের শেষে যদি কোনো #EXTINF বাকি থাকে
    if (currentExtInf) {
      m3uContent += `${currentExtInf}\n`;
    }

    return new Response(m3uContent, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.apple.mpegurl",
        "Content-Disposition": `inline; filename="Reborn_Playlist_${user.phone}.m3u"`,
        "Access-Control-Allow-Origin": "*"
      }
    });

  } catch (error) {
    return new Response("#EXTM3U\n#EXTINF:-1, ❌ Server Error\nhttp://error.local", { status: 500 });
  }
}
