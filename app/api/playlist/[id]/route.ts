// ফাইল পাথ: app/api/playlist/[id]/route.ts
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const client = await clientPromise;
    const db = client.db("all_in_one_reborn_db");

    let userId;
    try { userId = new ObjectId(params.id); } catch (e) {
      return new Response("#EXTM3U\n#EXTINF:-1, ❌ Invalid User ID\nhttp://error.local", { status: 400 });
    }

    const user = await db.collection("web_users").findOne({ _id: userId });

    if (!user) {
      return new Response("#EXTM3U\n#EXTINF:-1, ❌ User Not Found\nhttp://error.local", { status: 404 });
    }

    const now = new Date();
    if (!user.isPremium || (user.premiumExpiry && new Date(user.premiumExpiry) < now)) {
      return new Response("#EXTM3U\n#EXTINF:-1 tvg-logo=\"https://placehold.co/600x400/000/f00?text=Expired\", 🚫 Subscription Expired!\nhttp://expired.local", {
        headers: { "Content-Type": "application/vnd.apple.mpegurl" }
      });
    }

    const host = req.headers.get('host');
    const protocol = host?.includes('localhost') ? 'http' : 'https';
    const baseUrl = `${protocol}://${host}`;

    const streams = await db.collection("posted_streams").find({}).toArray();
    let m3uContent = "#EXTM3U x-tvg-url=\"\"\n";

    // 🎯 ডাটাবেস লিংক মাস্কিং (পুরো লিংক পাইপসহ Base64 হবে)
    streams.forEach(stream => {
      let rawTitle = (stream.title || "").replace(/tvg-[a-zA-Z0-9\-]+="[^"]*"/g, "").replace(/(https?:\/\/[^\s]+)/g, "").replace(/^[,-\s]+/, "").trim() || "Live TV";
      const url = stream.stream_url;

      if (url) {
        let fullUrlWithPipe = url.replace(/[\r\n\s]+/g, "").trim(); 
        const encodedUrl = encodeURIComponent(Buffer.from(fullUrlWithPipe).toString('base64'));
        
        // 🎯 পাইপ আর বাইরে রাখলাম না, সব Base64 এর ভেতর লুকিয়ে দিলাম
        const secureUrl = `${baseUrl}/api/secure-play/live.m3u8?uid=${user._id}&stream=${encodedUrl}`;
        
        m3uContent += `#EXTINF:-1 tvg-logo="${stream.logo || ''}" group-title="${stream.group || 'Live TV'}", ${rawTitle}\n`;
        m3uContent += `${secureUrl}\n`;
      }
    });

    // 🎯 মার্জড M3U (অ্যাডমিন প্যানেল) মাস্কিং
    const mergedM3uDoc = await db.collection("system_settings").findOne({ key: "merged_premium_m3u" });
    if (mergedM3uDoc && mergedM3uDoc.content) {
      const lines = mergedM3uDoc.content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim();
        if (!line) continue;

        if (line.startsWith('#')) {
          m3uContent += line + '\n';
        } else if (line.startsWith('http')) {
          let fullUrlWithPipe = line;
          const encodedUrl = encodeURIComponent(Buffer.from(fullUrlWithPipe).toString('base64'));
          const secureUrl = `${baseUrl}/api/secure-play/live.m3u8?uid=${user._id}&stream=${encodedUrl}`;
          m3uContent += secureUrl + '\n';
        } else {
          m3uContent += line + '\n';
        }
      }
    }

    return new Response(m3uContent, {
      headers: {
        "Content-Type": "application/vnd.apple.mpegurl",
        "Content-Disposition": `attachment; filename="All_In_One_Reborn_${user.phone}.m3u"`
      }
    });

  } catch (error) {
    return new Response("#EXTM3U\n#EXTINF:-1, ❌ Server Error\nhttp://error.local", { status: 500 });
  }
}
