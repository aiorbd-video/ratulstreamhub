// ফাইল পাথ: app/api/secure-play/[filename]/route.ts
import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const uid = searchParams.get('uid');
    const streamEncoded = searchParams.get('stream');

    if (!uid || !streamEncoded) {
      return new Response("Unauthorized Access!", { status: 401 });
    }

    const client = await clientPromise;
    const db = client.db("all_in_one_reborn_db");
    
    const user = await db.collection("web_users").findOne({ _id: new ObjectId(uid) });
    const now = new Date();

    if (!user || !user.isPremium || (user.premiumExpiry && new Date(user.premiumExpiry) < now)) {
      return NextResponse.redirect("https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4");
    }

    // 🎯 ১. ডিকোড করে আসল লিংক বের করা
    let realStreamUrl = Buffer.from(streamEncoded, 'base64').toString('utf-8');
    realStreamUrl = realStreamUrl.replace(/[\r\n\s]+/g, "").trim();

    // 🎯 ২. হেডার আলাদা করা (Pipe থাকলে)
    let fetchHeaders: any = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "*/*"
    };
    
    if (realStreamUrl.includes('|')) {
      const parts = realStreamUrl.split('|');
      realStreamUrl = parts[0].trim();
      
      const headerString = parts.slice(1).join('&').replace(/\|/g, '&');
      const headerPairs = headerString.split('&');
      for (const pair of headerPairs) {
        const [key, ...valueParts] = pair.split('=');
        if (key && valueParts.length > 0) {
          fetchHeaders[key.trim()] = decodeURIComponent(valueParts.join('=').trim());
        }
      }
    }

    // 🚀 ৩. ম্যাজিক প্রক্সি: Vercel নিজে M3U8 ফাইলটি ডাউনলোড করবে
    try {
      const response = await fetch(realStreamUrl, { 
        headers: fetchHeaders,
        redirect: 'follow' 
      });
      
      if (!response.ok) {
         return NextResponse.redirect(realStreamUrl); // ফলব্যাক
      }

      const contentType = response.headers.get('content-type') || '';
      
      // 🎯 ৪. যদি ফাইলটি M3U8 হয়, তবে প্রক্সি করে ভেতরের ইউআরএলগুলো ফিক্স করা হবে
      if (contentType.includes('mpegurl') || contentType.includes('m3u8') || realStreamUrl.includes('.m3u8')) {
        const text = await response.text();
        
        const baseUrl = new URL(realStreamUrl);
        const basePath = baseUrl.origin + baseUrl.pathname.substring(0, baseUrl.pathname.lastIndexOf('/') + 1);

        // ফাইলের ভেতরের খণ্ডিত লিংকগুলোকে পূর্ণাঙ্গ লিংকে রূপান্তর করা
        const rewrittenText = text.split('\n').map(line => {
          const tLine = line.trim();
          if (!tLine || tLine.startsWith('#')) return line; // কমেন্ট বা ট্যাগ
          if (tLine.startsWith('http')) return line; // আগে থেকেই ফুল লিংক
          if (tLine.startsWith('/')) return baseUrl.origin + tLine; // রুট লিংক
          return basePath + tLine; // রিলেটিভ লিংক
        }).join('\n');

        // রিডাইরেক্ট না করে সরাসরি 200 Status-এ টেক্সট পাঠানো হচ্ছে (যাতে লিংক ফাঁস না হয়)
        return new Response(rewrittenText, {
          status: 200,
          headers: {
            "Content-Type": "application/vnd.apple.mpegurl",
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "no-store"
          }
        });
      }

      // যদি .ts বা .mp4 ফাইল হয়, তবে প্রক্সি না করে সরাসরি রিডাইরেক্ট
      return NextResponse.redirect(realStreamUrl);

    } catch (e) {
       return NextResponse.redirect(realStreamUrl);
    }

  } catch (error) {
    return new Response("Server Error", { status: 500 });
  }
}
