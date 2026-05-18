// 파일 পাথ: app/api/play_xtream/route.ts
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

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, Accept",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const username = url.searchParams.get('username');
    const password = url.searchParams.get('password');
    const stream_id_raw = url.searchParams.get('stream_id');

    if (!username || !password || !stream_id_raw) {
      return new Response("Missing parameters", { status: 400, headers: corsHeaders });
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
      return new Response("Unauthorized Access!", { status: 401, headers: corsHeaders });
    }
    
    const now = new Date();
    if (!user.isPremium || (user.premiumExpiry && new Date(user.premiumExpiry) < now)) {
      return new Response(null, {
        status: 302,
        headers: {
          "Location": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
          ...corsHeaders
        }
      });
    }

    const forwardedFor = req.headers.get('x-forwarded-for');
    const clientIp = forwardedFor ? forwardedFor.split(',')[0].trim() : 'unknown';
    const currentTime = now.getTime();
    
    if (user.activeIp && user.activeIp !== clientIp && (currentTime - (user.lastActiveTime || 0)) < 120000) {
       return new Response("Account is being used on another device!", { status: 403, headers: corsHeaders });
    } else {
       await db.collection("web_users").updateOne({ _id: user._id }, { $set: { activeIp: clientIp, lastActiveTime: currentTime } });
    }

    const targetId = parseInt(stream_id_raw.replace(/\.(m3u8|ts|mp4)$/, ''));
    let realUrl = "";

    const streams = await db.collection("posted_streams").find({}).toArray();
    for (const s of streams) {
      if (s.stream_url && generateId(s.stream_url.split('|')[0].trim()) === targetId) {
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
              realUrl = line; // পাইপসহ পুরো অরিজিনাল লাইনটি রিড করবে
              break;
            }
          }
        }
      }
    }

    if (realUrl) {
      // 🚀 আল্টিমেট ট্রিক: Next.js এর কোনো রিডাইরেক্ট মেথড ব্যবহার না করে ডাইরেক্ট নেটিভ রেসপন্স পাঠানো হলো।
      // এর ফলে পাইপের ভেতরের User-Agent, Cookie, Referer, Origin সব ১০০% অক্ষত অবস্থায় প্লেয়ারের কাছে যাবে।
      return new Response(null, {
        status: 302,
        headers: {
          "Location": realUrl.trim(),
          ...corsHeaders
        }
      });
    } else {
      return new Response("Stream Not Found!", { status: 404, headers: corsHeaders });
    }

  } catch (error) {
    return new Response("Server Error", { status: 500, headers: corsHeaders });
  }
}
