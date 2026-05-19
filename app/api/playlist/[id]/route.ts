// ফাইল পাথ: app/api/playlist/[id]/route.ts
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export const dynamic = 'force-dynamic';

// 🎯 CORS সিকিউরিটি হেডার
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, Accept",
};

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const userAgent = req.headers.get('user-agent')?.toLowerCase() || '';

    // 📱 কড়া চেকার: শুধুমাত্র Android Apps, Android System এবং IPTV প্লেয়ার অ্যালাউড
    const isAndroidOrPlayer = 
      userAgent.includes('android') || 
      userAgent.includes('exoplayer') || 
      userAgent.includes('dalvik') || 
      userAgent.includes('iptv') || 
      userAgent.includes('smarters') ||
      userAgent.includes('vlc');

    // 🚫 ডেস্কটপ বা ব্রাউজার থেকে প্লেলিস্ট ওপেন করা সম্পূর্ণ ব্লক!
    if (!isAndroidOrPlayer) {
      return new Response("🚫 Access Denied! This M3U playlist can only be opened inside Android IPTV Applications.", { 
        status: 403, 
        headers: { "Content-Type": "text/plain", ...corsHeaders } 
      });
    }

    const client = await clientPromise;
    const db = client.db("all_in_one_reborn_db");

    let userId;
    try { userId = new ObjectId(params.id); } catch (e) {
      return new Response("#EXTM3U\r\n#EXTINF:-1, ❌ Invalid User ID\r\nhttp://error.local", { status: 400, headers: corsHeaders });
    }

    const user = await db.collection("web_users").findOne({ _id: userId });

    if (!user || !user.isPremium || (user.premiumExpiry && new Date(user.premiumExpiry) < new Date())) {
      return new Response("#EXTM3U\r\n#EXTINF:-1 tvg-logo=\"https://placehold.co/600x400/000/f00?text=Expired\", 🚫 Subscription Expired!\r\nhttp://expired.local", {
        headers: { "Content-Type": "application/vnd.apple.mpegurl", ...corsHeaders }
      });
    }

    const streams = await db.collection("posted_streams").find({}).toArray();
    let m3uContent = "#EXTM3U x-tvg-url=\"\"\r\n";

    // 🎯 ম্যাজিক: ডাইরেক্ট অরিজিনাল লিংক (কোনো secure-play, base64 বা মাস্কিং নেই)
    streams.forEach(stream => {
      let rawTitle = (stream.title || "").replace(/tvg-[a-zA-Z0-9\-]+="[^"]*"/g, "").replace(/(https?:\/\/[^\s]+)/g, "").replace(/^[,-\s]+/, "").trim() || "Live TV";
      const url = stream.stream_url;

      if (url) {
        let fullUrl = url.replace(/[\r\n\s]+/g, "").trim(); 
        
        // \r\n (Carriage Return) ব্যবহার করা হলো যাতে প্লেয়ার ঠিকমতো লাইন বুঝতে পারে
        m3uContent += `#EXTINF:-1 tvg-logo="${stream.logo || ''}" group-title="${stream.group || 'Live TV'}", ${rawTitle}\r\n`;
        m3uContent += `${fullUrl}\r\n`;
      }
    });

    // 🎯 মার্জড M3U (অ্যাডমিন প্যানেল) ডাইরেক্ট পাস
    const mergedM3uDoc = await db.collection("system_settings").findOne({ key: "merged_premium_m3u" });
    if (mergedM3uDoc && mergedM3uDoc.content) {
      const lines = mergedM3uDoc.content.split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim();
        if (!line) continue;

        if (line.startsWith('#')) {
          m3uContent += `${line}\r\n`;
        } else if (line.startsWith('http')) {
          let fullUrl = line.replace(/[\r\n\s]+/g, "").trim();
          m3uContent += `${fullUrl}\r\n`;
        } else {
          m3uContent += `${line}\r\n`;
        }
      }
    }

    return new Response(m3uContent, {
      headers: {
        "Content-Type": "application/vnd.apple.mpegurl",
        "Content-Disposition": `attachment; filename="All_In_One_Reborn_${user.phone}.m3u"`,
        ...corsHeaders
      }
    });

  } catch (error) {
    return new Response("#EXTM3U\r\n#EXTINF:-1, ❌ Server Error\r\nhttp://error.local", { status: 500, headers: corsHeaders });
  }
}
