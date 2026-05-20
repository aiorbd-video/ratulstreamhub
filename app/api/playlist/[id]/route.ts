// ফাইল পাথ: app/api/playlist/[id]/route.ts
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export const dynamic = 'force-dynamic';

// 🛡️ কড়া CORS ও ক্যাশ পলিসি
const securityHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "*",
  "Cache-Control": "no-store, no-cache, must-revalidate",
  "Pragma": "no-cache",
  "Expires": "0"
};

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: securityHeaders });
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const userAgent = req.headers.get('user-agent')?.toLowerCase() || '';

    // 🚫 ১. সুপার স্ট্রিক্ট অ্যাপ লক (Televizo Exclusive)
    // TiviMate, Smarters, VLC, এবং সব ব্রাউজার সরাসরি ব্লক হবে!
    const isTelevizo = userAgent.includes('televizo') || userAgent.includes('exoplayer');
    const isBlockedApp = userAgent.includes('tivimate') || userAgent.includes('smarters') || userAgent.includes('vlc');
    const isBrowser = userAgent.includes('mozilla') && !userAgent.includes('tv');

    if (!isTelevizo || isBlockedApp || isBrowser) {
      return new Response("🚫 Access Denied! This premium playlist is strictly locked. You can ONLY open this inside the 'Televizo' IPTV application.", { 
        status: 403, 
        headers: { "Content-Type": "text/plain", ...securityHeaders } 
      });
    }

    // 🗄️ ২. ডাটাবেস কানেকশন
    const client = await clientPromise;
    const db = client.db("all_in_one_reborn_db");

    let userId;
    try { 
      userId = new ObjectId(params.id); 
    } catch (e) {
      return new Response("#EXTM3U\n#EXTINF:-1, ❌ Invalid User ID\nhttp://error.local", { status: 400, headers: securityHeaders });
    }

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

    // 🎯 ৩. ডাটা ফেচিং
    const [streams, mergedM3uDoc] = await Promise.all([
      db.collection("posted_streams").find({}, { projection: { title: 1, group: 1, logo: 1, stream_url: 1 } }).toArray(),
      db.collection("system_settings").findOne({ key: "merged_premium_m3u" }, { projection: { content: 1 } })
    ]);

    let rawM3uText = "";

    for (const stream of streams) {
      if (!stream.stream_url) continue;
      let rawTitle = (stream.title || "").replace(/tvg-[a-zA-Z0-9\-]+="[^"]*"/g, "").replace(/(https?:\/\/[^\s]+)/g, "").replace(/^[,-\s]+/, "").trim() || "Live TV";
      rawM3uText += `#EXTINF:-1 tvg-logo="${stream.logo || ''}" group-title="${stream.group || 'Live TV'}", ${rawTitle}\n`;
      rawM3uText += `${stream.stream_url.trim()}\n`;
    }

    if (mergedM3uDoc && mergedM3uDoc.content) {
      rawM3uText += `${mergedM3uDoc.content}\n`;
    }

    // 🚀 ৪. Televizo অপটিমাইজড পার্সার (Native VLCOPT Builder)
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
        } catch(e) {}
      } 
      else if (line.startsWith('http')) {
        let fullUrl = line.replace(/[\r\n\s]+/g, "").trim();

        // পাইপ থেকে হেডার আলাদা করে Televizo ফরমেটে আনা হচ্ছে
        if (fullUrl.includes('|')) {
          const parts = fullUrl.split('|');
          fullUrl = parts[0];
          const headerPairs = parts[1].split('&');
          for (const pair of headerPairs) {
            const [key, val] = pair.split('=');
            if (key && val) tempHeaders[key.trim()] = val.trim();
          }
        }

        if (currentExtInf) {
          m3uContent += `${currentExtInf}\n`;
          currentExtInf = ""; 
        }

        // 🎯 Televizo এর পছন্দের স্টাইল: URL এর ঠিক আগে #EXTVLCOPT বসবে
        if (tempHeaders['User-Agent']) {
          m3uContent += `#EXTVLCOPT:http-user-agent=${tempHeaders['User-Agent']}\n`;
        }
        if (tempHeaders['Referer']) {
          m3uContent += `#EXTVLCOPT:http-referrer=${tempHeaders['Referer']}\n`;
        }
        
        // Televizo কুকি এবং অন্যান্য হেডার Pipe এ সাপোর্ট করে, তাই ওগুলো লিংকেই থাকবে
        let extraPipes = "";
        for (const [key, val] of Object.entries(tempHeaders)) {
          if (key !== 'User-Agent' && key !== 'Referer') {
            extraPipes += `${extraPipes ? '&' : '|'}${key}=${val}`;
          }
        }

        m3uContent += `${fullUrl}${extraPipes}\n`;
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
        "Content-Disposition": `inline; filename="Televizo_Reborn_${user.phone || 'VIP'}.m3u"`,
        ...securityHeaders
      }
    });

  } catch (error) {
    return new Response("#EXTM3U\n#EXTINF:-1, ❌ Server Error\nhttp://error.local", { status: 500, headers: securityHeaders });
  }
}
