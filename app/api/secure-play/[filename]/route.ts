// ফাইল পাথ: app/api/secure-play/[filename]/route.ts
import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export const dynamic = 'force-dynamic';

// 🎯 ব্রাউজার CORS ব্লক এনাবল এবং হেডার সেটআপ
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, Accept",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET(req: Request) {
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

    // 🚫 অ্যান্ড্রয়েড অ্যাপ ছাড়া অন্য যেকোনো ব্রাউজার, পিসি বা আইওএস (iOS) সরাসরি ব্লক
    if (!isAndroidOrPlayer) {
      return new Response("🚫 Access Denied! This link can only be opened inside Android Applications.", { 
        status: 403, 
        headers: corsHeaders 
      });
    }

    const { searchParams } = new URL(req.url);
    const uid = searchParams.get('uid');
    const streamEncoded = searchParams.get('stream');

    if (!uid || !streamEncoded) {
      return new Response("Unauthorized Access!", { status: 401, headers: corsHeaders });
    }

    const client = await clientPromise;
    const db = client.db("all_in_one_reborn_db");
    
    const user = await db.collection("web_users").findOne({ _id: new ObjectId(uid) });
    const now = new Date();

    if (!user || !user.isPremium || (user.premiumExpiry && new Date(user.premiumExpiry) < now)) {
      return new Response(null, {
        status: 302,
        headers: {
          "Location": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
          ...corsHeaders
        }
      });
    }

    // 🎯 অরিজিনাল লিংক ডিকোড (কোনো কাটছাঁট, প্রক্সি বা এডিট ছাড়া)
    let realStreamUrl = Buffer.from(streamEncoded, 'base64').toString('utf-8');

    // 🚀 জিরো-এডিট ডিরেক্ট পাস-থ্রু: হুবহু অরিজিনাল লিংকটি রেসপন্সের মাধ্যমে প্লেয়ারে পাঠানো হলো
    return new Response(null, {
      status: 302,
      headers: {
        "Location": realStreamUrl,
        ...corsHeaders
      }
    });

  } catch (error) {
    return new Response("Server Error", { status: 500, headers: corsHeaders });
  }
}
