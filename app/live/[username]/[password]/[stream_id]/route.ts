// ফাইল পাথ: app/live/[username]/[password]/[stream_id]/route.ts
import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

// 🎯 উন্নত Hash ফাংশন (প্লেয়ার API এর সাথে হুবহু মিলতে হবে)
const generateId = (str: string) => {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
  }
  return Math.abs(hash);
};

export async function GET(req: Request, { params }: { params: { username: string, password: string, stream_id: string } }) {
  try {
    const client = await clientPromise;
    const db = client.db("all_in_one_reborn_db");

    // ১. ভেরিফিকেশন এবং অ্যান্টি-শেয়ারিং চেক
    const user = await db.collection("web_users").findOne({ phone: params.username });
    const now = new Date();
    
    if (!user || (user.password ? user.password !== params.password : params.password !== params.username)) {
      return new Response("Unauthorized Access!", { status: 401 });
    }
    
    if (!user.isPremium || (user.premiumExpiry && new Date(user.premiumExpiry) < now)) {
      return NextResponse.redirect("https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4");
    }

    const clientIp = req.headers.get('x-forwarded-for') || 'unknown';
    const currentTime = now.getTime();
    
    if (user.activeIp && user.activeIp !== clientIp && (currentTime - (user.lastActiveTime || 0)) < 60000) {
      return new Response("Account is being used on another device!", { status: 403 });
    }
    
    await db.collection("web_users").updateOne({ _id: user._id }, { $set: { activeIp: clientIp, lastActiveTime: currentTime } });

    // ২. Stream ID রিয়েল লিংকে কনভার্ট করা
    const targetId = parseInt(params.stream_id.replace(/\.(m3u8|ts|mp4)$/, ''));
    let realUrl = "";

    const streams = await db.collection("posted_streams").find({}).toArray();
    for (const s of streams) {
      if (s.stream_url && generateId(s.stream_url) === targetId) {
        realUrl = s.stream_url;
        break;
      }
    }

    if (!realUrl) {
      const mergedM3uDoc = await db.collection("system_settings").findOne({ key: "merged_premium_m3u" });
      if (mergedM3uDoc && mergedM3uDoc.content) {
        const lines = mergedM3uDoc.content.split('\n');
        for (let line of lines) {
          line = line.trim();
          if (line.startsWith('http')) {
            const cleanUrl = line.split('|')[0].trim();
            if (generateId(cleanUrl) === targetId) {
              realUrl = line; 
              break;
            }
          }
        }
      }
    }

    if (realUrl) {
      return NextResponse.redirect(realUrl);
    } else {
      return new Response("Stream Not Found!", { status: 404 });
    }

  } catch (error) {
    return new Response("Server Error", { status: 500 });
  }
}
