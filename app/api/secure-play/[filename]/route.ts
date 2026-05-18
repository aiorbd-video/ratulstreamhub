// ফাইল পাথ: app/api/secure-play/[filename]/route.ts
import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const userAgent = req.headers.get('user-agent')?.toLowerCase() || '';

    // 🟢 হোয়াইটলিস্ট: মিডিয়া প্লেয়ার, অ্যান্ড্রয়েড অ্যাপ এবং স্মার্ট টিভি
    const isMobileAppOrPlayer = 
      userAgent.includes('exoplayer') ||         
      userAgent.includes('dalvik') ||            
      userAgent.includes('applecoremedia') ||    
      userAgent.includes('android') ||           
      userAgent.includes('iphone') ||            
      userAgent.includes('tv') ||                
      userAgent.includes('vlc') ||               
      userAgent.includes('smarters') ||          
      userAgent.includes('iptv') ||              
      userAgent.includes('kodi');                

    // 🔴 ব্লকলিস্ট: শুধুমাত্র পিসির ডেস্কটপ ব্রাউজার (লিংক চুরির মূল জায়গা)
    const isDesktopBrowser = 
      (userAgent.includes('windows nt') || userAgent.includes('macintosh')) && 
      (userAgent.includes('chrome') || userAgent.includes('firefox') || userAgent.includes('safari') || userAgent.includes('edge')) &&
      !isMobileAppOrPlayer;

    if (isDesktopBrowser) {
      return new Response("🚫 Access Denied! Scraping from Desktop Browsers is strictly prohibited.", { 
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

    // 🎯 ডিকোড এবং আসল লিংকে রিডাইরেক্ট (প্লেয়ার এখানে হেডারসহ আসবে, তাই শুধু মেইন লিংক দিলেই হবে)
    let realStreamUrl = Buffer.from(streamEncoded, 'base64').toString('utf-8');
    realStreamUrl = realStreamUrl.replace(/[\r\n\s]+/g, "").trim();

    return NextResponse.redirect(realStreamUrl);

  } catch (error) {
    return new Response("Server Error", { status: 500 });
  }
}
