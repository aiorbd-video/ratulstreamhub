// ফাইল পাথ: app/api/playlist/[id]/route.ts
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export const dynamic = 'force-dynamic';

// 🛡️ কড়া CORS ও ক্যাশ পলিসি (Enterprise M3U Standard)
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

    // 🚫 ১. অ্যান্টি-স্ক্র্যাপিং লজিক (Browser Blacklist)
    // পিসি বা মোবাইলের নরমাল ব্রাউজার থেকে লিংক চুরি বন্ধ, কিন্তু প্লেয়ারগুলো এক্সেস পাবে
    const isBrowser = userAgent.includes('mozilla') && 
                      (userAgent.includes('chrome') || userAgent.includes('safari') || userAgent.includes('firefox') || userAgent.includes('edge')) && 
                      !userAgent.includes('tv') && 
                      !userAgent.includes('smarters') && 
                      !userAgent.includes('iptv');

    if (isBrowser) {
      return new Response("🚫 Access Denied! Premium IPTV Playlist. Browser access is strictly prohibited.", { 
        status: 403, 
        headers: { "Content-Type": "text/plain", ...securityHeaders } 
      });
    }

    // 🗄️ ২. ডাটাবেস কানেকশন ও মেমোরি অপটিমাইজেশন
    const client = await clientPromise;
    const db = client.db("all_in_one_reborn_db");

    let userId;
    try { 
      userId = new ObjectId(params.id); 
    } catch (e) {
      return new Response("#EXTM3U\n#EXTINF:-1, ❌ Invalid User ID\nhttp://error.local", { status: 400, headers: securityHeaders });
    }

    // Projection ব্যবহার করে শুধু দরকারি ফিল্ড আনা হচ্ছে (ডাটাবেস স্পিড বুস্ট হবে)
    const user = await db.collection("web_users").findOne(
      { _id: userId }, 
      { projection: { isPremium: 1, premiumExpiry: 1, phone: 1 } }
    );

    // 🎯 ৩. প্রিমিয়াম ইউজার এবং এক্সপায়ার ডেট চেক ভ্যালিডেশন
    if (!user || !user.isPremium || (user.premiumExpiry && new Date(user.premiumExpiry) < new Date())) {
      return new Response("#EXTM3U\n#EXTINF:-1, 🚫 Subscription Expired or Invalid!\nhttp://expired.local", {
        status: 403,
        headers: { "Content-Type": "application/vnd.apple.mpegurl", ...securityHeaders }
      });
    }

    // 🎯 ৪. প্যারালাল ডাটা ফেচিং (Streams & Merged Text)
    const [streams, mergedM3uDoc] = await Promise.all([
      db.collection("posted_streams").find({}, { projection: { title: 1, group: 1, logo: 1, stream_url: 1 } }).toArray(),
      db.collection("system_settings").findOne({ key: "merged_premium_m3u" }, { projection: { content: 1 } })
    ]);

    let rawM3uText = "";

    // posted_streams ডাটা প্রসেসিং
    for (const stream of streams) {
      if (!stream.stream_url) continue;
      let rawTitle = (stream.title || "").replace(/tvg-[a-zA-Z0-9\-]+="[^"]*"/g, "").replace(/(https?:\/\/[^\s]+)/g, "").replace(/^[,-\s]+/, "").trim() || "Live TV";
      rawM3uText += `#EXTINF:-1 tvg-logo="${stream.logo || ''}" group-title="${stream.group || 'Live TV'}", ${rawTitle}\n`;
      rawM3uText += `${stream.stream_url.trim()}\n`;
    }

    // মার্জড ফাইল বা টেক্সট ডাটা প্রসেসিং
    if (mergedM3uDoc && mergedM3uDoc.content) {
      rawM3uText += `${mergedM3uDoc.content}\n`;
    }

    // 🚀 ৫. Televizo Native Parser Engine (The Ultimate Converter)
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

        // যদি কোনো লিংকের শেষে আগে থেকে পাইপ থাকে, ওটা ভেঙে হেডার বের করা হচ্ছে
        if (fullUrl.includes('|')) {
          const parts = fullUrl.split('|');
          fullUrl = parts[0].trim();
          if (parts[1]) {
            const headerPairs = parts[1].split('&');
            for (const pair of headerPairs) {
              const equalIndex = pair.indexOf('=');
              if (equalIndex > 0) {
                const key = pair.substring(0, equalIndex).trim().toLowerCase();
                const val = pair.substring(equalIndex + 1).trim();
                if (key === 'cookie') tempHeaders['Cookie'] = val;
                else if (key === 'user-agent') tempHeaders['User-Agent'] = val;
                else if (key === 'referer' || key === 'referrer') tempHeaders['Referer'] = val;
                else if (key === 'origin') tempHeaders['Origin'] = val;
              }
            }
          }
        }

        // #EXTINF রাইট করা হচ্ছে
        if (currentExtInf) {
          m3uContent += `${currentExtInf}\n`;
          currentExtInf = ""; 
        }

        // 🎯 Televizo নেটিভ ফরম্যাট জেনারেশন (লিংকের ঠিক ওপরে ট্যাগগুলো বসবে)
        if (tempHeaders['User-Agent']) {
          m3uContent += `#EXTVLCOPT:http-user-agent=${tempHeaders['User-Agent']}\n`;
        }
        if (tempHeaders['Referer']) {
          m3uContent += `#EXTVLCOPT:http-referrer=${tempHeaders['Referer']}\n`;
        }
        if (tempHeaders['Cookie']) {
          m3uContent += `#EXTVLCOPT:http-cookie=${tempHeaders['Cookie']}\n`;
        }
        if (tempHeaders['Origin']) {
          m3uContent += `#EXTVLCOPT:http-origin=${tempHeaders['Origin']}\n`;
        }
        
        // 🚀 ফাইনাল ম্যাজিক: মূল লিংকটি থাকবে একদম ফ্রেশ ও ক্লিন (পাইপ সাইন ছাড়া) যাতে প্লেয়ার ক্র্যাশ না করে
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

    // 🎯 ৬. রেসপন্স ডেলিভারি (M3U হেডার ফাইলসহ)
    return new Response(m3uContent, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.apple.mpegurl",
        "Content-Disposition": `inline; filename="All_In_One_Televizo_${user.phone || 'VIP'}.m3u"`,
        ...securityHeaders
      }
    });

  } catch (error) {
    console.error("Playlist Rollback Error:", error);
    return new Response("#EXTM3U\n#EXTINF:-1, ❌ Server Error\nhttp://error.local", { status: 500, headers: securityHeaders });
  }
}
