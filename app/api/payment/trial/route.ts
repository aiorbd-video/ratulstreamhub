import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function POST(req: Request) {
  try {
    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json({ message: "ইউজার আইডি পাওয়া যায়নি!" }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db("all_in_one_reborn_db");

    // ইউজার আগে ট্রায়াল নিয়েছে কি না তা চেক করা হচ্ছে
    const user = await db.collection("web_users").findOne({ _id: new ObjectId(userId) });
    
    if (!user) {
      return NextResponse.json({ message: "ইউজার পাওয়া যায়নি!" }, { status: 404 });
    }

    if (user.hasUsedTrial) {
      return NextResponse.json({ message: "দুঃখিত! আপনি ইতিমধ্যে একবার ফ্রি ট্রায়াল সুবিধাটি ব্যবহার করে ফেলেছেন।" }, { status: 400 });
    }

    // ⏳ 120 মিনিটের জন্য ফ্রি ট্রায়াল টাইম সেট করা হলো
    const expiryDate = new Date();
    expiryDate.setMinutes(expiryDate.getMinutes() + 120);

    // ইউজারকে প্রিমিয়াম করা হলো এবং ট্রায়াল লক মার্কার (hasUsedTrial) সেট করা হলো
    await db.collection("web_users").updateOne(
      { _id: new ObjectId(userId) },
      { 
        $set: { 
          isPremium: true, 
          premiumExpiry: expiryDate,
          hasUsedTrial: true 
        } 
      }
    );

    return NextResponse.json({ message: "আপনার ১২০ মিনিটের ফ্রি ট্রায়াল সফলভাবে চালু হয়েছে! উপভোগ করুন সম্পূর্ণ অ্যাড-ফ্রি স্ট্রিমিং।", success: true });
  } catch (error) {
    return NextResponse.json({ message: "সার্ভারে কোনো সমস্যা হয়েছে!" }, { status: 500 });
  }
}
