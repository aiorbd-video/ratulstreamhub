// ফাইল পাথ: app/api/secure-play/route.ts
import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    // 🛡️ লেভেল ১ সিকিউরিটি: ব্রাউজার ব্লক করা (Anti-Scraping)
    const userAgent = req.headers.get('user-agent')?.toLowerCase() || '';
    
    // সাধারণ ওয়েব ব্রাউজারের ফুটপ্রিন্ট (Footprint)
    const isBrowser = userAgent.includes('mozilla') || 
                      userAgent.includes('chrome') || 
                      userAgent.includes('safari') || 
                      userAgent.includes('firefox') || 
                      userAgent.includes('edge') ||
                      userAgent.includes('opera');

    // যদি রিকোয়েস্ট কোনো ওয়েব ব্রাউজার থেকে আসে, তবে ব্লক করে দাও
    if (isBrowser) {
      return new Response("🚫 Access Denied! Scraping is strictly prohibited. Please use a dedicated IPTV Player like TiviMate, VLC, or IPTV Smarters Pro.", { 
        status: 403,
        headers: { 'Content-Type': 'text/plain' }
      });
    }

    // 🛡️ লেভেল ২ সিকিউরিটি: টোকেন ও ইউজার আইডি ভ্যালিডেশন
    const { searchParams } = new URL(req.url);
    const uid = searchParams.get('uid');
    const streamEncoded = searchParams.get('stream');

    if (!uid || !streamEncoded) {
      return new Response("Unauthorized Access! Missing parameters.", { status: 401 });
    }

    const client = await clientPromise;
    const db = client.db("all_in_one_reborn_db");
    
    // 🛡️ লেভেল ৩ সিকিউরিটি: রিয়েল-টাইমে ইউজারের স্ট্যাটাস চেক করা
    const user = await db.collection("web_users").findOne({ _id: new ObjectId(uid) });
    const now = new Date();

    if (!user || !user.isPremium || (user.premiumExpiry && new Date(user.premiumExpiry) < now)) {
      // মেয়াদ না থাকলে বা ফ্রি ইউজার লিংক শেয়ার করলে এই এরর ভিডিওটি প্লে হবে
      return NextResponse.redirect("https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4");
    }

    // 🎯 সব ভ্যালিডেশন পাস করলে Base64 লিংকটিকে ডিকোড করে আসল লিংকে পাঠানো হবে
    const realStreamUrl = Buffer.from(streamEncoded, 'base64').toString('utf-8');

    // ইউজারের প্লেয়ারকে আসল সার্ভারে রিডাইরেক্ট করা
    return NextResponse.redirect(realStreamUrl);

  } catch (error) {
    return new Response("Server Error", { status: 500 });
  }
}
