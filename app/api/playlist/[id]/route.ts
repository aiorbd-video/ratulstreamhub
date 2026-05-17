// ফাইল পাথ: app/api/playlist/[id]/route.ts
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const client = await clientPromise;
    const db = client.db("all_in_one_reborn_db");

    const user = await db.collection("web_users").findOne({ _id: new ObjectId(params.id) });

    if (!user) {
      return new Response("#EXTM3U\n#EXTINF:-1, ❌ Invalid User\nhttp://error.local", { status: 404 });
    }

    const now = new Date();
    // 🛡️ প্লেলিস্ট লেভেল সিকিউরিটি
    if (!user.isPremium || (user.premiumExpiry && new Date(user.premiumExpiry) < now)) {
      if (user.isPremium) {
        await db.collection("web_users").updateOne({ _id: new ObjectId(params.id) }, { $set: { isPremium: false } });
      }
      return new Response("#EXTM3U\n#EXTINF:-1 tvg-logo=\"https://placehold.co/600x400/000/f00?text=Expired\", 🚫 Subscription Expired! Please Renew.\nhttp://expired.local", {
        headers: { "Content-Type": "application/vnd.apple.mpegurl" }
      });
    }

    const host = req.headers.get('host');
    const protocol = host?.includes('localhost') ? 'http' : 'https';
    const baseUrl = `${protocol}://${host}`;

    const streams = await db.collection("posted_streams").find({}).toArray();

    let m3uContent = "#EXTM3U x-tvg-url=\"\"\n";

    // 🎯 পার্ট ১: টেলিগ্রাম বট থেকে আসা লিংকগুলো (যেহেতু এগুলোতে আপনার নিজস্ব ক্যাটাগরি, তাই এটা আগের মতোই থাকবে)
    streams.forEach(stream => {
      let rawTitle = stream.title || "";
      let logo = stream.logo || ""; 
      let group = stream.group || "All In One Reborn VIP"; 

      if (!logo) {
        const logoMatch = rawTitle.match(/tvg-logo="([^"]+)"/);
        if (logoMatch) logo = logoMatch[1];
        else logo = "https://placehold.co/600x400/1e293b/ef4444?text=LIVE+TV";
      }

      rawTitle = rawTitle.replace(/tvg-[a-zA-Z0-9\-]+="[^"]*"/g, "");
      rawTitle = rawTitle.replace(/(https?:\/\/[^\s]+)/g, "");
      let cleanTitle = rawTitle.replace(/^[,-\s]+/, "").trim() || "Live TV";

      const url = stream.stream_url;

      if (url) {
        let cleanUrl = url.replace(/[\r\n\s]+/g, "").trim();
        let pipeHeaders = "";
        
        if (cleanUrl.includes("|")) {
          const parts = cleanUrl.split("|");
          cleanUrl = parts[0]; 
          pipeHeaders = "|" + parts.slice(1).join("|"); 
        }

        const encodedUrl = encodeURIComponent(Buffer.from(cleanUrl).toString('base64'));
        const secureUrl = `${baseUrl}/api/secure-play?uid=${user._id}&stream=${encodedUrl}${pipeHeaders}`;
        
        m3uContent += `#EXTINF:-1 tvg-logo="${logo}" group-title="${group}", ${cleanTitle}\n`;
        m3uContent += `${secureUrl}\n`;
      }
    });

    // 🎯 পার্ট ২: অ্যাডমিন প্যানেল থেকে দেওয়া লিংকগুলো (Line-by-Line Processing)
    const mergedM3uDoc = await db.collection("system_settings").findOne({ key: "merged_premium_m3u" });
    if (mergedM3uDoc && mergedM3uDoc.content) {
      const lines = mergedM3uDoc.content.split('\n');
      let secureMergedContent = '';

      for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim();
        
        if (!line) continue; // ফাঁকা লাইন স্কিপ করবে

        if (line.startsWith('#')) {
          // 🚀 ম্যাজিক: যদি লাইনটি # দিয়ে শুরু হয় (যেমন: #EXTINF), তারমানে এটি লোগো, নাম বা ক্যাটাগরির লাইন। 
          // এটিকে কোনো এডিট ছাড়া হুবহু বসিয়ে দেওয়া হচ্ছে, যাতে অরিজিনাল ডাটা ১০০% ঠিক থাকে।
          secureMergedContent += line + '\n';
        } else if (line.startsWith('http')) {
          // 🔒 যদি লাইনটি http দিয়ে শুরু হয়, তারমানে এটি স্ট্রিমিং লিংক। শুধু এটিকেই মাস্ক করা হবে।
          let urlStr = line;
          let pipeHeaders = "";

          if (urlStr.includes("|")) {
            const parts = urlStr.split("|");
            urlStr = parts[0]; 
            pipeHeaders = "|" + parts.slice(1).join("|"); 
          }

          const encoded = encodeURIComponent(Buffer.from(urlStr).toString('base64'));
          const secureUrl = `${baseUrl}/api/secure-play?uid=${user._id}&stream=${encoded}${pipeHeaders}`;
          
          secureMergedContent += secureUrl + '\n';
        } else {
          // অন্য কোনো লাইন থাকলে হুবহু বসে যাবে
          secureMergedContent += line + '\n';
        }
      }
      
      m3uContent += "\n" + secureMergedContent;
    }

    return new Response(m3uContent, {
      headers: {
        "Content-Type": "application/vnd.apple.mpegurl",
        "Content-Disposition": `attachment; filename="Reborn_VIP_${user.phone}.m3u"`
      }
    });

  } catch (error) {
    return new Response("#EXTM3U\n#EXTINF:-1, ❌ Server Error\nhttp://error.local", { status: 500 });
  }
}
