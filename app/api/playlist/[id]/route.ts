// ফাইল পাথ: app/api/playlist/[id]/route.ts
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export const dynamic = 'force-dynamic';

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

    // 🚫 ব্রাউজার হ্যাকার ব্লক (সিকিউরিটি অক্ষুণ্ন রাখা হলো)
    const isBrowser = userAgent.includes('mozilla') && 
                      (userAgent.includes('chrome') || userAgent.includes('safari') || userAgent.includes('firefox') || userAgent.includes('edge')) && 
                      !userAgent.includes('tv') && 
                      !userAgent.includes('smarters') && 
                      !userAgent.includes('iptv');

    if (isBrowser) {
      return new Response("🚫 Access Denied! Please open this M3U playlist inside Televizo app.", { 
        status: 403, 
        headers: { "Content-Type": "text/plain", ...securityHeaders } 
      });
    }

    const client = await clientPromise;
    const db = client.db("all_in_one_reborn_db");

    let userId;
    try { userId = new ObjectId(params.id); } catch (e) {
      return new Response("#EXTM3U\n#EXTINF:-1, ❌ Invalid User ID\nhttp://error.local", { status: 400, headers: securityHeaders });
    }

    const user = await db.collection("web_users").findOne(
      { _id: userId }, 
      { projection: { isPremium: 1, premiumExpiry: 1, phone: 1 } }
    );

    // 🎯 ডাটাবেস থেকে ইউজারের মেয়াদ যাচাই (মেয়াদ শেষ হলে প্লেলিস্ট অফ হয়ে যাবে)
    if (!user || !user.isPremium || (user.premiumExpiry && new Date(user.premiumExpiry) < new Date())) {
      return new Response("#EXTM3U\n#EXTINF:-1, 🚫 Subscription Expired!\nhttp://expired.local", {
        status: 403,
        headers: { "Content-Type": "application/vnd.apple.mpegurl", ...securityHeaders }
      });
    }

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

    // 🚀 Televizo native parser engine
    let m3uContent = "#EXTM3U x-tvg-url=\"\"\n";

    // 🎯 ম্যাজিক: প্লেলিস্টের সবার উপরে ইউজারের মেয়াদ দেখানোর জন্য একটি ডামি চ্যানেল
    const expText = user.premiumExpiry 
      ? new Date(user.premiumExpiry).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) 
      : "Unlimited (Lifetime)";
    m3uContent += `#EXTINF:-1 tvg-logo="https://cdn-icons-png.flaticon.com/512/2740/2740600.png" group-title="⭐ Account Info", 👤 VIP Status | Expiry: ${expText}\n`;
    m3uContent += `http://local.info/account\n`;

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

        // 🎯 যদি ইনপুট লিংকে আগে থেকেই Pipe (|) ফরমেটে হেডার থাকে, ওটাকেও খুলে আলাদা করা হচ্ছে
        if (fullUrl.includes('|')) {
          const parts = fullUrl.split('|');
          fullUrl = parts[0].trim();
          if (parts[1]) {
            const headerPairs = parts[1].split('&');
            for (const pair of headerPairs) {
              const equalIndex = pair.indexOf('=');
              if (equalIndex > 0) {
                const key = pair.substring(0, equalIndex).trim();
                const val = pair.substring(equalIndex + 1).trim();
                if (key.toLowerCase() === 'cookie') tempHeaders['Cookie'] = val;
                else if (key.toLowerCase() === 'user-agent') tempHeaders['User-Agent'] = val;
                else if (key.toLowerCase() === 'referer' || key.toLowerCase() === 'referrer') tempHeaders['Referer'] = val;
                else if (key.toLowerCase() === 'origin') tempHeaders['Origin'] = val;
              }
            }
          }
        }

        // #EXTINF রাইট করা হচ্ছে
        if (currentExtInf) {
          m3uContent += `${currentExtInf}\n`;
          currentExtInf = ""; 
        }

        // 🎯 Televizo-র জন্য ১টি লিংকের বিপরীতে আলাদা আলাদা লাইনে EXTVLCOPT রাইট করা হচ্ছে
        if (tempHeaders['User-Agent']) {
          m3uContent += `#EXTVLCOPT:http-user-agent=${tempHeaders['User-Agent']}\n`;
        }
        if (tempHeaders['Referer']) {
          m3uContent += `#EXTVLCOPT:http-referrer=${tempHeaders['Referer']}\n`;
        }
        if (tempHeaders['Cookie']) {
          // ⚠️ Toffee-র মাল্টিপল '=' যুক্ত কুকি এখানে একদম র (Raw) অবস্থায় নিখুঁতভাবে বসবে
          m3uContent += `#EXTVLCOPT:http-cookie=${tempHeaders['Cookie']}\n`;
        }
        if (tempHeaders['Origin']) {
          m3uContent += `#EXTVLCOPT:http-origin=${tempHeaders['Origin']}\n`;
        }
        
        // 🚀 ফাইনাল ম্যাজিক: লিংকটি থাকবে একদম ফ্রেশ ও অরিজিনাল (কোনো পাইপ সাইন ছাড়া)
        m3uContent += `${fullUrl}\n`;
        
        // হেডার বাকেট রিসেট
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
        "Content-Disposition": `inline; filename="All_In_One_Televizo_${user.phone || 'VIP'}.m3u"`,
        ...securityHeaders
      }
    });

  } catch (error) {
    return new Response("#EXTM3U\n#EXTINF:-1, ❌ Server Error\nhttp://error.local", { status: 500, headers: securityHeaders });
  }
}
