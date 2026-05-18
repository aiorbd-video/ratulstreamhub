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
              realUrl = line; 
              break;
            }
          }
        }
      }
    }

    if (realUrl) {
      let finalUrl = realUrl.trim();
      
      // 🎯 ডিফল্ট ফেক হেডার (যদি লিংকে হেডার না থাকে)
      let customHeaders: Record<string, string> = {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "*/*"
      };

      // 🎯 ম্যাজিক পার্ট ১: পাইপ (|) থেকে হেডারগুলো আলাদা করে সার্ভারে সেট করা
      if (finalUrl.includes('|')) {
          const parts = finalUrl.split('|');
          finalUrl = parts[0].trim();
          const headerString = parts.slice(1).join('&').replace(/\|/g, '&');
          const headerPairs = headerString.split('&');
          for (const pair of headerPairs) {
              const [key, ...valueParts] = pair.split('=');
              if (key && valueParts.length > 0) {
                  customHeaders[key.trim()] = decodeURIComponent(valueParts.join('=').trim());
              }
          }
      }

      try {
          // 🎯 ম্যাজিক পার্ট ২: Vercel নিজে সঠিক হেডার দিয়ে অরিজিনাল সার্ভার থেকে M3U8 ডাউনলোড করবে
          const sourceRes = await fetch(finalUrl, { 
              headers: customHeaders,
              redirect: 'follow'
          });

          const contentType = sourceRes.headers.get('content-type') || '';

          // 🎯 ম্যাজিক পার্ট ৩: যদি এটি HLS (.m3u8) লাইভ স্ট্রিম হয়, তবে সেটিকে প্রক্সি করে প্লেয়ারে দেওয়া হবে
          if (contentType.includes('mpegurl') || contentType.includes('m3u8') || finalUrl.includes('.m3u8')) {
              const text = await sourceRes.text();
              const baseUrl = new URL(sourceRes.url || finalUrl);
              const basePath = baseUrl.pathname.substring(0, baseUrl.pathname.lastIndexOf('/') + 1);

              // ফাইলের ভেতরের খণ্ডিত লিংকগুলোকে পূর্ণাঙ্গ লিংকে রূপান্তর করা
              const rewrittenText = text.split('\n').map(line => {
                  const trimmedLine = line.trim();
                  if (!trimmedLine || trimmedLine.startsWith('#')) return line;
                  
                  if (trimmedLine.startsWith('http')) return trimmedLine;
                  if (trimmedLine.startsWith('/')) return `${baseUrl.protocol}//${baseUrl.host}${trimmedLine}`;
                  return `${baseUrl.protocol}//${baseUrl.host}${basePath}${trimmedLine}`;
              }).join('\n');

              return new Response(rewrittenText, {
                  status: 200,
                  headers: {
                      'Content-Type': 'application/vnd.apple.mpegurl',
                      'Access-Control-Allow-Origin': '*'
                  }
              });
          } else {
              // যদি সরাসরি .ts বা .mp4 ফাইল হয়, তবে প্রক্সি না করে শুধু রিডাইরেক্ট করবে
              return new Response(null, {
                  status: 302,
                  headers: { 'Location': finalUrl, 'Access-Control-Allow-Origin': '*' }
              });
          }

      } catch (e) {
          // সার্ভার রেসপন্স না দিলে ফলব্যাক হিসেবে রিডাইরেক্ট
          return new Response(null, {
              status: 302,
              headers: { 'Location': finalUrl, 'Access-Control-Allow-Origin': '*' }
          });
      }

    } else {
      return new Response("Stream Not Found!", { status: 404 });
    }

  } catch (error) {
    return new Response("Server Error", { status: 500 });
  }
}
