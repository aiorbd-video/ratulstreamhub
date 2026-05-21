// ফাইল পাথ: app/api/admin/m3u-sync/route.ts
import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const client = await clientPromise;
    const db = client.db("all_in_one_reborn_db");
    const doc = await db.collection("system_settings").findOne({ key: "m3u_urls" });
    return NextResponse.json({ urls: doc?.urls || [] });
  } catch (error) {
    return NextResponse.json({ urls: [] });
  }
}

export async function POST(req: Request) {
  try {
    const { urls } = await req.json();

    const client = await clientPromise;
    const db = client.db("all_in_one_reborn_db");

    // 🚀 ১. রকেট স্পিডে শুধু লিংকগুলো (URLs) সেভ করা হলো (কোনো ফেচিং ছাড়া)
    await db.collection("system_settings").updateOne(
      { key: "m3u_urls" },
      { $set: { urls, updatedAt: new Date() } },
      { upsert: true }
    );

    if (!urls || urls.length === 0) {
      await db.collection("system_settings").updateOne(
        { key: "merged_premium_m3u" }, 
        { $set: { content: "", updatedAt: new Date(0) } }
      );
      return NextResponse.json({ success: true, message: "সব M3U লিংক ডিলিট করা হয়েছে!" });
    }

    // 🚀 ২. ট্রিক: মার্জ ফাইলের সময় (updatedAt) জিরো করে দেওয়া হলো
    // এর ফলে On-Demand Sync বুঝতে পারবে যে নতুন লিংক এসেছে এবং সে নিজে থেকেই ফেচ করে নেবে।
    await db.collection("system_settings").updateOne(
      { key: "merged_premium_m3u" },
      { $set: { content: "", updatedAt: new Date(0) } },
      { upsert: true }
    );

    return NextResponse.json({ 
      success: true, 
      message: "M3U URLs রকেটের গতিতে সেভ হয়েছে! ব্যাকগ্রাউন্ড সিঙ্ক চালু করা হলো।" 
    });

  } catch (error) {
    return NextResponse.json({ success: false, message: "সার্ভার এরর!" }, { status: 500 });
  }
}
