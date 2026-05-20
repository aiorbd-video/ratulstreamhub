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

    // 🚫 ব্রাউজার ডাউনলোডার ব্লক (আগের সিকিউরিটি)
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

    const streams = await db.collection("posted_streams").find({}).toArray();
    let m3uContent = "#EXTM3U x-tvg-url=\"\"\n";

    // 🎯 ডাটাবেস স্ট্রিম পার্সিং
    streams.forEach(stream => {
      let rawTitle = (stream.title || "").replace(/tvg-[a-zA-Z0-9\-]+="[^"]*"/g, "").replace(/(https?:\/\/[^\s]+)/g, "").replace(/^[,-\s]+/, "").trim() || "Live TV";
      if (stream.stream_url) {
        m3uContent += `#EXTINF:-1 tvg-logo="${stream.logo || ''}" group-title="${stream.group || 'Live TV'}", ${rawTitle}\n`;
        m3uContent += `${stream.stream_url.replace(/[\r\n\s]+/g, "").trim()}\n`;
      }
    });

    // 🚀 স্মার্ট অটো-কনভার্টার: OTT Navigator ট্যাগগুলোকে গ্লোবাল Pipe (|) ফরম্যাটে রূপান্তর
    const mergedM3uDoc = await db.collection("system_settings").findOne({ key: "merged_premium_m3u" });
    if (mergedM3uDoc && mergedM3uDoc.content) {
      const lines = mergedM3uDoc.content.split(/\r?\n/);
      let tempHeaders: any = {};

      for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim();
        if (!line) continue;

        if (line.startsWith('#EXTINF')) {
          m3uContent += `${line}\n`;
        } 
        // User-Agent এবং Referer ধরা হচ্ছে
        else if (line.startsWith('#EXTVLCOPT:http-user-agent=')) {
          tempHeaders['User-Agent'] = line.substring(27).trim();
        } 
        else if (line.startsWith('#EXTVLCOPT:http-referer=')) {
          tempHeaders['Referer'] = line.substring(24).trim();
        } 
        // JSON Cookie ধরা হচ্ছে
        else if (line.startsWith('#EXTHTTP:')) {
          try {
            let jsonStr = line.substring(9);
            let parsed = JSON.parse(jsonStr);
            if (parsed.cookie || parsed.Cookie) tempHeaders['Cookie'] = parsed.cookie || parsed.Cookie;
            if (parsed.Origin || parsed.origin) tempHeaders['Origin'] = parsed.Origin || parsed.origin;
            if (parsed.Referer || parsed.referer) tempHeaders['Referer'] = parsed.Referer || parsed.referer;
          } catch(e){}
        } 
        // লিংক এবং Pipe অ্যাটাচমেন্ট
        else if (line.startsWith('http')) {
          let fullUrl = line.replace(/[\r\n\s]+/g, "").trim();

          // 🎯 ম্যাজিক: যদি লিংকে আগে থেকে Pipe না থাকে এবং আমরা ট্যাগ থেকে হেডার পেয়ে থাকি
          if (!fullUrl.includes('|') && Object.keys(tempHeaders).length > 0) {
            let pipeStr = "";
            for (const [key, val] of Object.entries(tempHeaders)) {
              pipeStr += `${pipeStr ? '&' : '|'}${key}=${val}`;
            }
            fullUrl += pipeStr; // লিংকের শেষে হেডারগুলো জুড়ে দেওয়া হলো
          }

          m3uContent += `${fullUrl}\n`;
          tempHeaders = {}; // পরের লিংকের জন্য টেম্পোরারি হেডার ক্লিয়ার
        } 
        else {
          // অন্য কোনো অজানা ট্যাগ থাকলে সেটা রেখে দেবে, শুধু VLC/HTTP ট্যাগগুলো সরাবে
          if (!line.startsWith('#EXTVLCOPT') && !line.startsWith('#EXTHTTP')) {
            m3uContent += `${line}\n`;
          }
        }
      }
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
