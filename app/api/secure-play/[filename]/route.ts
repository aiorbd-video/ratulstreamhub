// ফাইল পাথ: app/api/secure-play/[filename]/route.ts
import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const userAgent = req.headers.get('user-agent')?.toLowerCase() || '';

    // 🟢 ব্রাউজার হ্যাকার ব্লক করা
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

    // 🎯 অরিজিনাল লিংক ডিকোড করা হলো
    let realStreamUrl = Buffer.from(streamEncoded, 'base64').toString('utf-8');
    realStreamUrl = realStreamUrl.replace(/[\r\n\s]+/g, "").trim();

    // 🚀 স্মার্ট ডিটেক্টর লজিক
    if (realStreamUrl.includes('|')) {
      // 🟢 কন্ডিশন ১: লিংকে Pipe (|) থাকলে HLS Master Playlist Wrapper ব্যবহার করবে
      // এতে প্লেয়ার নিজে থেকে Pipe রিড করে হেডারগুলো আসল সার্ভারে পাঠিয়ে দেবে।
      const masterPlaylistWrapper = `#EXTM3U\n#EXT-X-VERSION:3\n#EXT-X-STREAM-INF:BANDWIDTH=2500000\n${realStreamUrl}`;
      
      return new Response(masterPlaylistWrapper, {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.apple.mpegurl",
          "Access-Control-Allow-Origin": "*"
        }
      });
    } else {
      // 🟢 কন্ডিশন ২: সাধারণ লিংক (যেমন Roarzone) হলে ডাইরেক্ট 302 Redirect করবে।
      // এতে কোনো এরর ছাড়াই সরাসরি প্লে হবে।
      return NextResponse.redirect(realStreamUrl);
    }

  } catch (error) {
    return new Response("Server Error", { status: 500 });
  }
}
