// ফাইল পাথ: app/api/playlist/[id]/route.ts
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export const dynamic = 'force-dynamic';

// 🎯 CORS প্রিফ্লাইট রিকোয়েস্ট (Connection Error ফিক্স করার জন্য এটি ১০০% জরুরি)
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

    // 🚫 ১. ব্রাউজার চোরদের ব্লক করার মাস্টার লজিক (Blacklist)
    // মোবাইল বা ডেস্কটপের যেকোনো Chrome, Safari, Firefox, Edge ব্রাউজার ব্লক হবে।
    // কিন্তু Smart TV (tv) বা IPTV অ্যাপ (smarters, iptv) ব্রাউজার ইঞ্জিন ব্যবহার করলেও অ্যালাউ হবে।
    const isBrowser = userAgent.includes('mozilla') && 
                      (userAgent.includes('chrome') || userAgent.includes('safari') || userAgent.includes('firefox') || userAgent.includes('edge')) && 
                      !userAgent.includes('tv') && 
                      !userAgent.includes('smarters') && 
                      !userAgent.includes('iptv');

    if (isBrowser) {
      return new Response("🚫 Access Denied! This link is protected. You can only open this M3U playlist inside an IPTV Player (e.g., TiviMate, IPTV Smarters). Browser downloading is strictly prohibited.", { 
        status: 403, 
        headers: { "Content-Type": "text/plain" } 
      });
    }

    // 🎯 (আইপিটিভি প্লেয়ার বা okhttp বা Empty User-Agent হলে কোড এখানে চলে আসবে এবং ডাটাবেস চেক করবে)
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

    // 🎯 অরিজিনাল ডাটাবেস লিংক (কোনো মাস্কিং ছাড়া)
    streams.forEach(stream => {
      let rawTitle = (stream.title || "").replace(/tvg-[a-zA-Z0-9\-]+="[^"]*"/g, "").replace(/(https?:\/\/[^\s]+)/g, "").replace(/^[,-\s]+/, "").trim() || "Live TV";
      const url = stream.stream_url;

      if (url) {
        let fullUrl = url.replace(/[\r\n\s]+/g, "").trim(); 
        m3uContent += `#EXTINF:-1 tvg-logo="${stream.logo || ''}" group-title="${stream.group || 'Live TV'}", ${rawTitle}\n`;
        m3uContent += `${fullUrl}\n`;
      }
    });

    // 🎯 অরিজিনাল মার্জড M3U
    const mergedM3uDoc = await db.collection("system_settings").findOne({ key: "merged_premium_m3u" });
    if (mergedM3uDoc && mergedM3uDoc.content) {
      const lines = mergedM3uDoc.content.split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim();
        if (!line) continue;

        if (line.startsWith('#')) {
          m3uContent += `${line}\n`;
        } else if (line.startsWith('http')) {
          let fullUrl = line.replace(/[\r\n\s]+/g, "").trim();
          m3uContent += `${fullUrl}\n`;
        } else {
          m3uContent += `${line}\n`;
        }
      }
    }

    // 🚀 ২. ডাউনলোড হ্যাকিং বন্ধ করার ফিক্স
    // attachment এর বদলে inline দেওয়া হলো, ফলে কেউ যদি হ্যাক করেও ঢোকে, ফাইল অটোমেটিক ডাউনলোড হবে না!
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
