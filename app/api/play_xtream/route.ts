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
      return NextResponse.redirect("https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4", { status: 302 });
    }

    // ২. আইপি লক
    const forwardedFor = req.headers.get('x-forwarded-for');
    const clientIp = forwardedFor ? forwardedFor.split(',')[0].trim() : 'unknown';
    const currentTime = now.getTime();
    
    if (user.activeIp && user.activeIp !== clientIp && (currentTime - (user.lastActiveTime || 0)) < 120000) {
       return new Response("Account is being used on another device!", { status: 403 });
    } else {
       await db.collection("web_users").updateOne({ _id: user._id }, { $set: { activeIp: clientIp, lastActiveTime: currentTime } });
    }

    // ৩. টার্গেট আইডি বের করা
    const targetId = parseInt(stream_id_raw.replace(/\.(m3u8|ts|mp4)$/, ''));
    let rawOriginalUrl = "";

    // 🎯 ডাটাবেস থেকে হুবহু লিংক বের করা (Zero Edit)
    const streams = await db.collection("posted_streams").find({}).toArray();
    for (const s of streams) {
      if (s.stream_url && generateId(s.stream_url.split('|')[0].trim()) === targetId) {
        rawOriginalUrl = s.stream_url;
        break;
      }
    }

    if (!rawOriginalUrl) {
      const mergedM3uDoc = await db.collection("system_settings").findOne({ key: "merged_premium_m3u" });
      if (mergedM3uDoc && mergedM3uDoc.content) {
        const lines = mergedM3uDoc.content.split('\n');
        for (let line of lines) {
          line = line.trim();
          if (line.startsWith('http')) {
            const cleanUrlForId = line.split('|')[0].trim(); 
            if (generateId(cleanUrlForId) === targetId) {
              rawOriginalUrl = line; // 🎯 ম্যাজিক: কোনো কাটছাঁট ছাড়া পুরো অরিজিনাল লাইনটিই নিয়ে নিলাম!
              break;
            }
          }
        }
      }
    }

    // 🎯 ৪. কোনো এডিট ছাড়া সরাসরি প্লেয়ারকে লিংক দিয়ে দেওয়া
    if (rawOriginalUrl) {
      return new Response(null, {
        status: 302,
        headers: {
          // 🚀 এখানে কোনো URL Encoding, Splitting বা Trim কিছুই করা হয়নি। 
          // আপনি অ্যাডমিন প্যানেলে যা দিয়েছেন, ঠিক সেটাই প্লেয়ারের কাছে চলে যাবে।
          "Location": rawOriginalUrl,
          "Access-Control-Allow-Origin": "*"
        }
      });
    } else {
      return new Response("Stream Not Found!", { status: 404 });
    }

  } catch (error) {
    return new Response("Server Error", { status: 500 });
  }
}
