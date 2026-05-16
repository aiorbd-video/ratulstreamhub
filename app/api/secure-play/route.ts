// ফাইল পাথ: app/api/secure-play/route.ts
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
    
    // ১. রিয়েল-টাইমে ইউজারের স্ট্যাটাস চেক করা হচ্ছে
    const user = await db.collection("web_users").findOne({ _id: new ObjectId(uid) });
    const now = new Date();

    if (!user || !user.isPremium || (user.premiumExpiry && new Date(user.premiumExpiry) < now)) {
      // মেয়াদ না থাকলে বা ফ্রি ইউজার লিংক শেয়ার করলে এই এরর ভিডিওটি প্লে হবে
      return NextResponse.redirect("https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4");
    }

    // ২. মেয়াদ থাকলে Base64 লিংকটিকে ডিকোড করে আসল লিংকে পাঠানো হবে
    const realStreamUrl = Buffer.from(streamEncoded, 'base64').toString('utf-8');

    // ৩. ইউজারের প্লেয়ারকে আসল সার্ভারে রিডাইরেক্ট করা
    return NextResponse.redirect(realStreamUrl);

  } catch (error) {
    return new Response("Server Error", { status: 500 });
  }
}
