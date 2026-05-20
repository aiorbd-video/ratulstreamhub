// ফাইল পাথ: app/api/playlist/[id]/route.ts
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export const dynamic = 'force-dynamic';

// 🛡️ কড়া CORS ও ক্যাশ পলিসি (Enterprise Standard)
const securityHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "*",
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  "Pragma": "no-cache",
  "Expires": "0",
  "X-Content-Type-Options": "nosniff"
};

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: securityHeaders });
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const userAgent = req.headers.get('user-agent')?.toLowerCase() || '';

    // 🚫 ১. এন্টারপ্রাইজ অ্যান্টি-স্ক্র্যাপিং লজিক (Browser Blacklist)
    const isBrowser = userAgent.includes('mozilla') && 
                      (userAgent.includes('chrome') || userAgent.includes('safari') || userAgent.includes('firefox') || userAgent.includes('edge')) && 
                      !userAgent.includes('tv') && 
                      !userAgent.includes('smarters') && 
                      !userAgent.includes('iptv');

    if (isBrowser) {
      return new Response("🚫 Access Denied! Premium IPTV Service. Browser access is strictly prohibited.", { 
        status: 403, 
        headers: { "Content-Type": "text/plain", ...securityHeaders } 
      });
    }

    // 🗄️ ২. ডাটাবেস কানেকশন ও ভ্যালিডেশন
    const client = await clientPromise;
    const db = client.db("all_in_one_reborn_db");

    let userId;
    try { 
      userId = new ObjectId(params.id); 
    } catch (e) {
      return new Response("#EXTM3U\n#EXTINF:-1, ❌ Invalid User ID\nhttp://error.local", { status: 400, headers: securityHeaders });
    }

    // 🚀 অপটিমাইজেশন: Projection ব্যবহার করে শুধু দরকারি ফিল্ড আনা হচ্ছে
    const user = await db.collection("web_users").findOne(
      { _id: userId }, 
      { projection: { isPremium: 1, premiumExpiry: 1, phone: 1 } }
    );

    if (!user || !user.isPremium || (user.premiumExpiry && new Date(user.premiumExpiry) < new Date())) {
      return new Response("#EXTM3U\n#EXTINF:-1, 🚫 Subscription Expired!\nhttp://expired.local", {
        status: 403,
        headers: { "Content-Type": "application/vnd.apple.mpegurl", ...securityHeaders }
      });
    }

    // 🎯 ৩. ফাস্ট ডাটা ফেচিং (Streams & Merged Settings) Parallel Execution
    const [streams, mergedM3uDoc] = await Promise.all([
      db.collection("posted_streams").find({}, { projection: { title: 1, group: 1, logo: 1, stream_url: 1 } }).toArray(),
      db.collection("system_settings").findOne({ key: "merged_premium_m3u" }, { projection: { content: 1 } })
    ]);

    let rawM3uText = "";

    // স্ট্রিম ডাটা প্রসেসিং
    for (const stream of streams) {
      if (!stream.stream_url) continue;
      let rawTitle = (stream.title || "").replace(/tvg-[a-zA-Z0-9\-]+="[^"]*"/g, "").replace(/(https?:\/\/[^\s]+)/g, "").replace(/^[,-\s]+/, "").trim() || "Live TV";
      rawM3uText += `#EXTINF:-1 tvg-logo="${stream.logo || ''}" group-title="${stream.group || 'Live TV'}", ${rawTitle}\n`;
      rawM3uText += `${stream.stream_url.trim()}\n`;
    }

    if (mergedM3uDoc && mergedM3uDoc.content) {
      rawM3uText += `${mergedM3uDoc.content}\n`;
    }

    // 🚀 ৪. এন্টারপ্রাইজ পার্সার (Pipe Format Generator)
    let m3uContent = "#EXTM3U x-tvg-url=\"\"\n";
    const lines = rawM3uText.split(/\r?\n/);
    
    let tempHeaders: Record<string, string> = {};
    let currentExtInf = "";

    for (let line of lines) {
      line = line.trim();
      if (!line || line.startsWith('#EXTM3U')) continue;

      if (line.startsWith('#EXTINF')) {
        if (currentExtInf) m3uContent += `${currentExtInf}\n`;
        currentExtInf = line;
      } 
      else if (line.startsWith('#EXTVLCOPT:http-user-agent=')) {
        tempHeaders['User-Agent'] = line.substring(27).trim();
      } 
      else if (line.startsWith('#EXTVLCOPT:http-referer=') || line.startsWith('#EXTVLCOPT:http-referrer=')) {
        tempHeaders['Referer'] = line.substring(line.indexOf('=') + 1).trim();
      } 
      else if (line.startsWith('#EXTHTTP:')) {
        try {
          const parsed = JSON.parse(line.substring(9));
          if (parsed.cookie || parsed.Cookie) tempHeaders['Cookie'] = parsed.cookie || parsed.Cookie;
          if (parsed.Origin || parsed.origin) tempHeaders['Origin'] = parsed.Origin || parsed.origin;
          if (parsed.Referer || parsed.referer || parsed.referrer || parsed.Referrer) {
            tempHeaders['Referer'] = parsed.Referer || parsed.referer || parsed.referrer || parsed.Referrer;
          }
          if (parsed['User-Agent'] || parsed['user-agent']) {
            tempHeaders['User-Agent'] = parsed['User-Agent'] || parsed['user-agent'];
          }
        } catch(e) { /* Ignore JSON parse errors */ }
      } 
      else if (line.startsWith('http')) {
        let fullUrl = line.replace(/[\r\n\s]+/g, "").trim();

        // পাইপ হেডার জেনারেট করা
        if (!fullUrl.includes('|') && Object.keys(tempHeaders).length > 0) {
          const pipeParts = Object.entries(tempHeaders).map(([k, v]) => `${k}=${v}`);
          fullUrl += `|${pipeParts.join('&')}`;
        }

        if (currentExtInf) {
          m3uContent += `${currentExtInf}\n`;
          currentExtInf = ""; 
        }
        
        // 🎯 ডাইরেক্ট অরিজিনাল লিংক প্লেয়ারকে দেওয়া হচ্ছে
        m3uContent += `${fullUrl}\n`;
        tempHeaders = {}; 
      } 
      else if (!line.startsWith('#EXTVLCOPT') && !line.startsWith('#EXTHTTP')) {
        if (currentExtInf) {
          m3uContent += `${currentExtInf}\n`;
          currentExtInf = "";
        }
        m3uContent += `${line}\n`;
      }
    }

    if (currentExtInf) m3uContent += `${currentExtInf}\n`;

    return new Response(m3uContent, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.apple.mpegurl",
        "Content-Disposition": `inline; filename="All_In_One_Reborn_${user.phone || 'VIP'}.m3u"`,
        ...securityHeaders
      }
    });

  } catch (error) {
    console.error("Playlist Generation Error:", error);
    return new Response("#EXTM3U\n#EXTINF:-1, ❌ Enterprise Server Error\nhttp://error.local", { status: 500, headers: securityHeaders });
  }
}
