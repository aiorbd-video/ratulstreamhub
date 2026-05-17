// ফাইল পাথ: app/player_api.php/route.ts
import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

// 🎯 স্ট্রিং থেকে ডাইনামিক Numeric ID বানানোর ফাংশন (Xtream API এর জন্য Number ID লাগে)
const generateId = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = Math.imul(31, hash) + str.charCodeAt(i) | 0;
  return Math.abs(hash);
};

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const username = searchParams.get('username');
    const password = searchParams.get('password'); // ইউজারের একাউন্টের পাসওয়ার্ড
    const action = searchParams.get('action');

    if (!username || !password) {
      return NextResponse.json({ user_info: { auth: 0 } });
    }

    const client = await clientPromise;
    const db = client.db("all_in_one_reborn_db");

    // ১. ইউজার ভেরিফিকেশন (ফোন নাম্বার ও পাসওয়ার্ড দিয়ে)
    const user = await db.collection("web_users").findOne({ phone: username, password: password });
    
    if (!user) {
      return NextResponse.json({ user_info: { auth: 0, status: "Incorrect Details" } });
    }

    const now = new Date();
    const isExpired = !user.isPremium || (user.premiumExpiry && new Date(user.premiumExpiry) < now);
    
    if (isExpired) {
      return NextResponse.json({ user_info: { auth: 0, status: "Expired" } });
    }

    // 🛡️ ২. অ্যান্টি-শেয়ারিং (১ ডিভাইস লগিন লিমিট)
    const clientIp = req.headers.get('x-forwarded-for') || 'unknown';
    const currentTime = now.getTime();
    
    // যদি অন্য কোনো IP থেকে রিকোয়েস্ট আসে এবং আগের ডিভাইসটি ১ মিনিটের মধ্যে অ্যাক্টিভ থাকে
    if (user.activeIp && user.activeIp !== clientIp && (currentTime - (user.lastActiveTime || 0)) < 60000) {
       return NextResponse.json({ user_info: { auth: 0, status: "Already watching on another device!" } });
    }
    
    // আইপি এবং অ্যাক্টিভ টাইম আপডেট করা হলো
    await db.collection("web_users").updateOne(
      { _id: user._id }, 
      { $set: { activeIp: clientIp, lastActiveTime: currentTime } }
    );

    // 🎯 ৩. Xtream Authentication Response
    if (!action) {
      return NextResponse.json({
        user_info: {
          username: user.phone,
          password: user.password,
          message: "Welcome to All In One Reborn VIP",
          auth: 1,
          status: "Active",
          exp_date: user.premiumExpiry ? Math.floor(new Date(user.premiumExpiry).getTime() / 1000) : null,
          is_trial: user.hasUsedTrial ? "0" : "1",
          active_cons: 1,
          max_connections: 1 // ১ ডিভাইসের লিমিট
        },
        server_info: {
          url: "ratulstreamhub.vercel.app",
          port: "443",
          https_port: "443",
          server_protocol: "https",
          rtmp_port: "80",
          timezone: "Asia/Dhaka",
          timestamp_now: Math.floor(Date.now() / 1000),
          time_now: new Date().toLocaleString(),
        }
      });
    }

    // 🎯 ৪. লাইভ টিভি ক্যাটাগরি (Groups) পাঠানো
    if (action === 'get_live_categories') {
      const streams = await db.collection("posted_streams").find({}).toArray();
      const categoriesMap = new Map();
      
      streams.forEach(s => {
        const group = s.group || "Live TV";
        categoriesMap.set(group, generateId(group));
      });

      // অ্যাডমিন প্যানেলের M3U থেকে ক্যাটাগরি বের করা
      const mergedM3uDoc = await db.collection("system_settings").findOne({ key: "merged_premium_m3u" });
      if (mergedM3uDoc && mergedM3uDoc.content) {
        const matches = mergedM3uDoc.content.matchAll(/group-title="([^"]+)"/g);
        for (const match of matches) {
          categoriesMap.set(match[1], generateId(match[1]));
        }
      }

      const categories = Array.from(categoriesMap, ([name, id]) => ({ category_id: id.toString(), category_name: name, parent_id: 0 }));
      return NextResponse.json(categories);
    }

    // 🎯 ৫. লাইভ টিভি চ্যানেল (Streams) পাঠানো
    if (action === 'get_live_streams') {
      const streams = await db.collection("posted_streams").find({}).toArray();
      const liveStreams: any[] = [];
      
      streams.forEach(stream => {
        let cleanTitle = (stream.title || "").replace(/tvg-[a-zA-Z0-9\-]+="[^"]*"/g, "").replace(/(https?:\/\/[^\s]+)/g, "").replace(/^[,-\s]+/, "").trim() || "Live TV";
        
        liveStreams.push({
          num: liveStreams.length + 1,
          name: cleanTitle,
          stream_type: "live",
          stream_id: generateId(stream.stream_url),
          stream_icon: stream.logo || "https://placehold.co/600x400/1e293b/ef4444?text=LIVE+TV",
          epg_channel_id: null,
          added: "1",
          category_id: generateId(stream.group || "Live TV").toString(),
          custom_sid: "",
          tv_archive: 0,
          direct_source: "",
          tv_archive_duration: 0
        });
      });

      // অ্যাডমিন প্যানেলের M3U চ্যানেল যুক্ত করা
      const mergedM3uDoc = await db.collection("system_settings").findOne({ key: "merged_premium_m3u" });
      if (mergedM3uDoc && mergedM3uDoc.content) {
        const lines = mergedM3uDoc.content.split('\n');
        let currentTitle = "Premium TV";
        let currentGroup = "Premium VIP";
        let currentLogo = "https://placehold.co/600x400/1e293b/ef4444?text=VIP+TV";

        for (let i = 0; i < lines.length; i++) {
          let line = lines[i].trim();
          if (line.startsWith('#EXTINF')) {
            const groupMatch = line.match(/group-title="([^"]+)"/);
            if (groupMatch) currentGroup = groupMatch[1];
            
            const logoMatch = line.match(/tvg-logo="([^"]+)"/);
            if (logoMatch) currentLogo = logoMatch[1];
            
            const titleSplit = line.split(',');
            if (titleSplit.length > 1) currentTitle = titleSplit.pop()?.trim() || "TV";
          } else if (line.startsWith('http')) {
            liveStreams.push({
              num: liveStreams.length + 1,
              name: currentTitle,
              stream_type: "live",
              stream_id: generateId(line.split('|')[0]), // পাইপ হেডার বাদ দিয়ে আইডি তৈরি
              stream_icon: currentLogo,
              epg_channel_id: null,
              added: "1",
              category_id: generateId(currentGroup).toString(),
              custom_sid: "",
              tv_archive: 0,
              direct_source: "",
              tv_archive_duration: 0
            });
          }
        }
      }

      return NextResponse.json(liveStreams);
    }

    return NextResponse.json([]);

  } catch (error) {
    return NextResponse.json({ user_info: { auth: 0, status: "Server Error" } }, { status: 500 });
  }
}
