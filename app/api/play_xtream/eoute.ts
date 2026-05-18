// ফাইল পাথ: app/api/play_xtream/route.ts
import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';

const generateId = (str: string) => {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
  }
  return Math.abs(hash);
};

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const username = url.searchParams.get('username');
    const password = url.searchParams.get('password');
    const stream_id_raw = url.searchParams.get('stream_id');

    if (!username || !password || !stream_id_raw) {
      return new Response("Missing parameters", { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db("all_in_one_reborn_db");

    // ১. ইউজার ভেরিফিকেশন
    const user = await db.collection("web_users").findOne({ phone: username });
    
    let isPasswordValid = false;
    if (user) {
      if (user.password) {
        isPasswordValid = await bcrypt.compare(password, user.password);
      } else {
        isPasswordValid = (password === username);
      }
    }

    if (!user || !isPasswordValid) {
      return new Response("Unauthorized Access!", { status: 401 });
    }
    
    const now = new Date();
    if (!user.isPremium || (user.premiumExpiry && new Date(user.premiumExpiry) < now)) {
      // 🎯 ফিক্স: স্ট্যাটাস 302 দিয়ে রিডাইরেক্ট (IPTV প্লেয়ারদের জন্য বাধ্যতামূলক)
      return NextResponse.redirect("https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4", { status: 302 });
    }

    // 🛡️ ২. অ্যান্টি-শেয়ারিং (সামান্য মডিফাই করা হলো যেন ফলস-ব্লক না হয়)
    const forwardedFor = req.headers.get('x-forwarded-for');
    const clientIp = forwardedFor ? forwardedFor.split(',')[0].trim() : 'unknown';
    const currentTime = now.getTime();
    
    if (user.activeIp && user.activeIp !== clientIp && (currentTime - (user.lastActiveTime || 0)) < 120000) {
       // অন্য কেউ দেখলে ব্লক করবে, কিন্তু ২ মিনিটের বাফার দেওয়া হলো
       return new Response("Account is being used on another device!", { status: 403 });
    } else {
       await db.collection("web_users").updateOne({ _id: user._id }, { $set: { activeIp: clientIp, lastActiveTime: currentTime } });
    }

    // ৩. Stream ID ম্যাচিং (সব ধরনের এক্সটেনশন যেমন .ts, .m3u8 ইগনোর করে)
    const targetId = parseInt(stream_id_raw.replace(/\.(m3u8|ts|mp4)$/, ''));
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
              realUrl = cleanUrl; 
              break;
            }
          }
        }
      }
    }

    if (realUrl) {
      const finalRedirectUrl = realUrl.split('|')[0].trim();
      // 🎯 আল্টিমেট ফিক্স: 302 ফাউন্ড স্ট্যাটাস দিয়ে অরিজিনাল ভিডিও লিংক সার্ভ করা
      return NextResponse.redirect(finalRedirectUrl, { status: 302 });
    } else {
      return new Response("Stream Not Found!", { status: 404 });
    }

  } catch (error) {
    return new Response("Server Error", { status: 500 });
  }
}
