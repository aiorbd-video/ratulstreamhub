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

    // 🚫 ব্রাউজার হ্যাকার ব্লক
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

    if (!user || !user.isPremium || (user.premiumExpiry && new Date(user.premiumExpiry) < new Date())) {
      return new Response("#EXTM3U\n#EXTINF:-1, 🚫 Subscription Expired!\nhttp://expired.local", {
        status: 403,
        headers: { "Content-Type": "application/vnd.apple.mpegurl", ...securityHeaders }
      });
    }

    // 🚀 THE MAGIC: On-Demand Auto Sync (Vercel-এর Cron ছাড়াই অটো আপডেট)
    const urlDoc = await db.collection("system_settings").findOne({ key: "m3u_urls" });
    const mergedDoc = await db.collection("system_settings").findOne({ key: "merged_premium_m3u" });

    let mergedContent = mergedDoc?.content || "";
    const lastSyncTime = mergedDoc?.updatedAt ? new Date(mergedDoc.updatedAt).getTime() : 0;
    const now = Date.now();
    const FIFTEEN_MINUTES = 15 * 60 * 1000;

    // যদি ১৫ মিনিটের বেশি পুরোনো হয়, তবে ইউজার রিকোয়েস্ট করার সাথেই নতুন টোকেন ফেচ করবে
    if (urlDoc && urlDoc.urls && urlDoc.urls.length > 0 && (now - lastSyncTime > FIFTEEN_MINUTES)) {
      const fetchPromises = urlDoc.urls.map(async (url: string) => {
        try {
          const res = await fetch(url.trim(), { cache: 'no-store', next: { revalidate: 0 } });
          if (res.ok) {
            let text = await res.text();
            // কোনো জঞ্জাল লাইন থাকলে তা সেফটির জন্য ক্লিন করে নেওয়া
            let autoCleanedText = text.replace(/([^"'\s=])(https?:\/\/)/gi, "$1\n$2").replace(/\n+/g, "\n");
            return `\n# --- Auto Synced: ${new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Dhaka' })} ---\n` + autoCleanedText.replace(/#EXTM3U.*\n/g, "").trim();
          }
          return "";
        } catch (e) { return ""; }
      });

      const results = await Promise.all(fetchPromises);
      mergedContent = results.join("\n\n");

      // ব্যাকগ্রাউন্ডে ডাটাবেস আপডেট করে রাখা, যাতে পরের ইউজার সাথে সাথে ডাটা পায়
      db.collection("system_settings").updateOne(
        { key: "merged_premium_m3u" },
        { $set: { content: mergedContent, updatedAt: new Date() } },
        { upsert: true }
      );
    }

    const streams = await db.collection("posted_streams").find({}, { projection: { title: 1, group: 1, logo: 1, stream_url: 1 } }).toArray();

    // 🚀 M3U বিল্ড শুরু
    let m3uContent = "#EXTM3U\n";

    // ⭐ ইউজারের মেয়াদ দেখানোর চ্যানেল (আবার ফিরিয়ে আনা হলো)
    const expText = user.premiumExpiry 
      ? new Date(user.premiumExpiry).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) 
      : "Unlimited (Lifetime)";
    m3uContent += `#EXTINF:-1 tvg-logo="https://cdn-icons-png.flaticon.com/512/2740/2740600.png" group-title="⭐ Account Info", 👤 VIP Status | Expiry: ${expText}\n`;
    m3uContent += `http://local.info/account\n`;

    // ডাটাবেসের নিজস্ব স্ট্রিমগুলো অ্যাড করা
    for (const stream of streams) {
      if (!stream.stream_url) continue;
      let rawTitle = (stream.title || "").trim();
      let group = (stream.group || "Live TV").trim();
      let logo = (stream.logo || "").trim();
      
      m3uContent += `#EXTINF:-1 tvg-logo="${logo}" group-title="${group}", ${rawTitle}\n`;
      m3uContent += `${stream.stream_url.trim()}\n`;
    }

    // অটো-আপডেট হওয়া টোকেনযুক্ত চ্যানেলগুলো অ্যাড করা
    if (mergedContent) {
      let cleanContent = mergedContent.trim();
      if (cleanContent.startsWith("#EXTM3U")) {
        cleanContent = cleanContent.substring(7).trim();
      }
      if (cleanContent) {
        m3uContent += cleanContent + "\n";
      }
    }

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
