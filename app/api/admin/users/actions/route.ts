// ফাইল পাথ: app/api/admin/users/action/route.ts
import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function POST(req: Request) {
  try {
    const { action, userId, premiumStatus } = await req.json();
    const client = await clientPromise;
    const db = client.db("all_in_one_reborn_db");

    // 🗑️ ইউজার ডিলিট করা
    if (action === 'delete') {
      await db.collection("web_users").deleteOne({ _id: new ObjectId(userId) });
      return NextResponse.json({ success: true, message: "ইউজারকে সফলভাবে ডিলিট করা হয়েছে!" });
    }

    // ✏️ ইউজার এডিট (প্রিমিয়াম স্ট্যাটাস পরিবর্তন)
    if (action === 'toggle_premium') {
      let updateData: any = { isPremium: premiumStatus };
      
      // যদি ম্যানুয়ালি প্রিমিয়াম অন করা হয়, তবে ডিফল্ট ৩০ দিনের মেয়াদ দেওয়া হবে
      if (premiumStatus) {
        let expiry = new Date();
        expiry.setDate(expiry.getDate() + 30);
        updateData.premiumExpiry = expiry;
      } else {
        updateData.premiumExpiry = null;
      }

      await db.collection("web_users").updateOne(
        { _id: new ObjectId(userId) },
        { $set: updateData }
      );
      return NextResponse.json({ success: true, message: `ইউজারের প্রিমিয়াম স্ট্যাটাস আপডেট হয়েছে!` });
    }

    return NextResponse.json({ success: false, message: "অবৈধ অ্যাকশন!" }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ success: false, message: "সার্ভার এরর!" }, { status: 500 });
  }
}
