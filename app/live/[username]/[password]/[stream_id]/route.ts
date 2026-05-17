import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

const generateId = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = Math.imul(31, hash) + str.charCodeAt(i) | 0;
  return Math.abs(hash);
};

export async function GET(req: Request, { params }: { params: { username: string, password: string, stream_id: string } }) {
  try {
    const client = await clientPromise;
    const db = client.db("all_in_one_reborn_db");

    // ১. ভেরিফিকেশন এবং অ্যান্টি-শেয়ারিং চেক
    const user = await db.collection("web_users").findOne({ phone: params.username, password: params.password });
    const now = new Date();
    
    if (!user || !user.isPremium || (user.premiumExpiry && new Date(user.premiumExpiry) < now)) {
      return NextResponse.redirect("https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4");
    }

    const clientIp = req.headers.get('x-forwarded-for') || 'unknown';
    const currentTime = now.getTime();
    
    if (user.activeIp && user.activeIp !== clientIp && (currentTime - (user.lastActiveTime || 0)) < 60000) {
      return new Response("Account is being used on another device!", { status: 403 });
    }
    
    await db.collection("web_users").updateOne({ _id: user._id }, { $set: { activeIp: clientIp, lastActiveTime: currentTime } });

    // ২. Stream ID (যেমন: 12345.m3u8) থেকে এক্সটেনশন বাদ দিয়ে আসল আইডি বের করা
    const targetId = parseInt(params.stream_id.replace(/\.(m3u8|ts)$/, ''));
    let realUrl = "";

    // ৩. ডাটাবেস থেকে রিয়েল লিংক খোঁজা
    const streams = await db.collection("posted_streams").find({}).toArray();
    for (const s of streams) {
      if (generateId(s.stream_url) === targetId) {
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
            const cleanUrl = line.split('|')[0]; // পাইপ হেডার রিমুভ
            if (generateId(cleanUrl) === targetId) {
              realUrl = line; // পাইপ হেডারসহ পুরো অরিজিনাল লিংকটি প্লেয়ারকে দেওয়া হবে
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
