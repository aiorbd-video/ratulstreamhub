// ফাইল পাথ: app/api/secure-play/route.ts
import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const userAgent = req.headers.get('user-agent')?.toLowerCase() || '';
    
    const isBrowser = userAgent.includes('mozilla') || 
                      userAgent.includes('chrome') || 
                      userAgent.includes('safari') || 
                      userAgent.includes('firefox') || 
                      userAgent.includes('edge') ||
                      userAgent.includes('opera');

    if (isBrowser) {
      return new Response("🚫 Access Denied! Scraping is strictly prohibited. Please use a dedicated IPTV Player like TiviMate, VLC, or IPTV Smarters Pro.", { 
        status: 403,
        headers: { 'Content-Type': 'text/plain' }
      });
    }

    const { searchParams } = new URL(req.url);
    const uid = searchParams.get('uid');
    const streamEncoded = searchParams.get('stream');

    if (!uid || !streamEncoded) {
      return new Response("Unauthorized Access! Missing parameters.", { status: 401 });
    }

    const client = await clientPromise;
    const db = client.db("all_in_one_reborn_db");
    
    const user = await db.collection("web_users").findOne({ _id: new ObjectId(uid) });
    const now = new Date();

    if (!user || !user.isPremium || (user.premiumExpiry && new Date(user.premiumExpiry) < now)) {
      return NextResponse.redirect("https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4");
    }

    // 🎯 ফিক্স: ডিকোড করার পর লিংকের শেষে কোনো আবর্জনা থাকলে তা ক্লিন করা
    let realStreamUrl = Buffer.from(streamEncoded, 'base64').toString('utf-8');
    realStreamUrl = realStreamUrl.replace(/[\r\n\s]+/g, "").trim();

    // ইউজারের প্লেয়ারকে আসল সার্ভারে রিডাইরেক্ট করা
    return NextResponse.redirect(realStreamUrl);

  } catch (error) {
    return new Response("Server Error", { status: 500 });
  }
}
