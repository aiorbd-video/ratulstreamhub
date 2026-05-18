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
      return NextResponse.redirect("https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4", { status: 302 });
    }

    const forwardedFor = req.headers.get('x-forwarded-for');
    const clientIp = forwardedFor ? forwardedFor.split(',')[0].trim() : 'unknown';
    const currentTime = now.getTime();
    
    if (user.activeIp && user.activeIp !== clientIp && (currentTime - (user.lastActiveTime || 0)) < 120000) {
       return new Response("Account is being used on another device!", { status: 403 });
    } else {
       await db.collection("web_users").updateOne({ _id: user._id }, { $set: { activeIp: clientIp, lastActiveTime: currentTime } });
    }

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
            // পাইপ হেডার আলাদা না করে শুধু স্পেস ক্লিন করে চেক করা হচ্ছে
            const cleanUrl = line.split('|')[0].trim();
            if (generateId(cleanUrl) === targetId) {
              realUrl = line; // সম্পূর্ণ অরিজিনাল পাইপসহ লিংকটি নেওয়া হলো
              break;
            }
          }
        }
      }
    }

    if (realUrl) {
      let finalRedirectUrl = realUrl.trim();
      
      // 🎯 আল্টিমেট ফিক্স: পাইপ (|) ক্যারেক্টারকে URL Encode (%7C) করা হলো। 
      // এতে Next.js ক্র্যাশ করবে না এবং TiviMate/Smarters অ্যাপ ব্যাকগ্রাউন্ডে হেডারটি পার্স করতে পারবে।
      if (finalRedirectUrl.includes('|')) {
        const parts = finalRedirectUrl.split('|');
        finalRedirectUrl = parts[0] + '%7C' + parts.slice(1).join('|');
      }
      
      return NextResponse.redirect(finalRedirectUrl, { status: 302 });
    } else {
      return new Response("Stream Not Found!", { status: 404 });
    }

  } catch (error) {
    return new Response("Server Error", { status: 500 });
  }
}
