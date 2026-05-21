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
      { projection: { isPremium: 1, premiumExpiry: 1 } }
    );

    // 🎯 ইউজার মেয়াদ চেক লজিক
    if (!user || !user.isPremium || (user.premiumExpiry && new Date(user.premiumExpiry) < new Date())) {
      return new Response("#EXTM3U\n#EXTINF:-1, 🚫 Subscription Expired!\nhttp://expired.local", {
        status: 403,
        headers: { "Content-Type": "text/plain; charset=utf-8", ...securityHeaders }
      });
    }

    const [streams, mergedM3uDoc] = await Promise.all([
      db.collection("posted_streams").find({}, { projection: { title: 1, group: 1, logo: 1, stream_url: 1 } }).toArray(),
      db.collection("system_settings").findOne({ key: "merged_premium_m3u" }, { projection: { content: 1 } })
    ]);

    // 🚀 একদম খাঁটি ও অরিজিনাল M3U ফরম্যাট বিল্ড করা হচ্ছে
    let m3uContent = "#EXTM3U\n";

    // ১. posted_streams থেকে আসা চ্যানেলগুলো কোনো রকম মডিফিকেশন ছাড়া প্রিন্ট করা
    for (const stream of streams) {
      if (!stream.stream_url) continue;
      let rawTitle = (stream.title || "").trim();
      let group = (stream.group || "Live TV").trim();
      let logo = (stream.logo || "").trim();
      
      m3uContent += `#EXTINF:-1 tvg-logo="${logo}" group-title="${group}", ${rawTitle}\n`;
      m3uContent += `${stream.stream_url.trim()}\n`;
    }

    // ২. merged_premium_m3u ফাইলে আপনি যেভাবে পেস্ট করেছেন, হুবহু সেই ডাটা আউটপুট দেওয়া
    if (mergedM3uDoc && mergedM3uDoc.content) {
      let cleanContent = mergedM3uDoc.content.trim();
      // ডাবল হেডার এড়াতে যদি কন্টেন্টের শুরুতে #EXTM3U থাকে তা কেটে বাদ দেওয়া হচ্ছে
      if (cleanContent.startsWith("#EXTM3U")) {
        cleanContent = cleanContent.substring(7).trim();
      }
      if (cleanContent) {
        m3uContent += cleanContent + "\n";
      }
    }

    // 🎯 ফাইনাল রেসপন্স: Content-Type একদম সাধারণ text/plain দেওয়া হলো যাতে টেলিভিজো সরাসরি র টেক্সট পড়তে পারে
    return new Response(m3uContent, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        ...securityHeaders
      }
    });

  } catch (error) {
    return new Response("#EXTM3U\n#EXTINF:-1, ❌ Server Error\nhttp://error.local", { status: 500, headers: securityHeaders });
  }
}
