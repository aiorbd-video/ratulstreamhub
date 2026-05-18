// ফাইল পাথ: app/api/secure-play/[filename]/route.ts
import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const userAgent = req.headers.get('user-agent')?.toLowerCase() || '';

    // 🟢 ব্রাউজার হ্যাকার ব্লক করা (শুধুমাত্র আইপিটিভি অ্যাপ এবং ফোনে চলবে)
    const isMobileAppOrPlayer = 
      userAgent.includes('exoplayer') ||         
      userAgent.includes('applecoremedia') ||    
      userAgent.includes('android') ||           
      userAgent.includes('iphone') ||            
      userAgent.includes('tv') ||                
      userAgent.includes('vlc') ||               
      userAgent.includes('smarters') ||          
      userAgent.includes('iptv');                

    const isDesktopBrowser = 
      (userAgent.includes('windows nt') || userAgent.includes('macintosh')) && 
      (userAgent.includes('chrome') || userAgent.includes('firefox') || userAgent.includes('safari')) &&
      !isMobileAppOrPlayer;

    if (isDesktopBrowser) {
      return new Response("🚫 Access Denied! This secure stream can only be played in IPTV Apps.", { status: 403 });
    }

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

    // 🎯 ডিকোড করে অরিজিনাল লিংক বের করা এবং ডাইরেক্ট প্লে করা
    let realStreamUrl = Buffer.from(streamEncoded, 'base64').toString('utf-8');
    realStreamUrl = realStreamUrl.replace(/[\r\n\s]+/g, "").trim();

    return NextResponse.redirect(realStreamUrl);

  } catch (error) {
    return new Response("Server Error", { status: 500 });
  }
}
