// ফাইল পাথ: app/api/secure-play/route.ts
import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const userAgent = req.headers.get('user-agent')?.toLowerCase() || '';

    // 🟢 হোয়াইটলিস্ট (Whitelist): মিডিয়া প্লেয়ার, অ্যান্ড্রয়েড অ্যাপ এবং স্মার্ট টিভি
    const isMobileAppOrPlayer = 
      userAgent.includes('exoplayer') ||         // Android Native Player (SonyLiv, Toffee uses this)
      userAgent.includes('dalvik') ||            // Android Apps Default HTTP Client
      userAgent.includes('applecoremedia') ||    // iOS / Apple TV Player
      userAgent.includes('android') ||           // All Android Direct Requests
      userAgent.includes('iphone') ||            // All iOS Direct Requests
      userAgent.includes('tv') ||                // Smart TVs (TiviMate, Android TV)
      userAgent.includes('vlc') ||               // VLC Player
      userAgent.includes('smarters') ||          // IPTV Smarters Pro
      userAgent.includes('iptv') ||              // General IPTV Apps
      userAgent.includes('kodi');                // Kodi Media Center

    // 🔴 ব্লকলিস্ট (Blocklist): শুধুমাত্র পিসির ডেস্কটপ ব্রাউজার (Scraping এর মূল জায়গা)
    const isDesktopBrowser = 
      (userAgent.includes('windows nt') || userAgent.includes('macintosh')) && 
      (userAgent.includes('chrome') || userAgent.includes('firefox') || userAgent.includes('safari') || userAgent.includes('edge')) &&
      !isMobileAppOrPlayer; // যদি ডেস্কটপ ব্রাউজার হয় এবং সেটি কোনো প্লেয়ার না হয়

    // যদি কেউ পিসির ব্রাউজার দিয়ে লিংক চুরি করতে চায়, তাকে ব্লক করো
    if (isDesktopBrowser) {
      return new Response("🚫 Access Denied! Scraping from Desktop Browsers is strictly prohibited. Please use our App or a dedicated IPTV Player.", { 
        status: 403,
        headers: { 'Content-Type': 'text/plain' }
      });
    }

    // 🛡️ লেভেল ২: টোকেন ও ইউজার আইডি ভ্যালিডেশন
    const { searchParams } = new URL(req.url);
    const uid = searchParams.get('uid');
    const streamEncoded = searchParams.get('stream');

    if (!uid || !streamEncoded) {
      return new Response("Unauthorized Access! Missing parameters.", { status: 401 });
    }

    const client = await clientPromise;
    const db = client.db("all_in_one_reborn_db");
    
    // 🛡️ লেভেল ৩: রিয়েল-টাইমে ইউজারের স্ট্যাটাস চেক করা
    const user = await db.collection("web_users").findOne({ _id: new ObjectId(uid) });
    const now = new Date();

    if (!user || !user.isPremium || (user.premiumExpiry && new Date(user.premiumExpiry) < now)) {
      // মেয়াদ না থাকলে বা ফ্রি ইউজার লিংক শেয়ার করলে এই এরর ভিডিওটি প্লে হবে
      return NextResponse.redirect("https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4");
    }

    // 🎯 সব ভ্যালিডেশন পাস করলে Base64 লিংকটিকে ডিকোড করে আসল লিংকে রিডাইরেক্ট করা
    let realStreamUrl = Buffer.from(streamEncoded, 'base64').toString('utf-8');
    realStreamUrl = realStreamUrl.replace(/[\r\n\s]+/g, "").trim();

    return NextResponse.redirect(realStreamUrl);

  } catch (error) {
    return new Response("Server Error", { status: 500 });
  }
}
