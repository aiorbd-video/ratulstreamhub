// ফাইল পাথ: app/api/admin/approve/route.ts
import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function POST(req: Request) {
  try {
    const { paymentId, userId, pkg } = await req.json();

    const client = await clientPromise;
    const db = client.db("all_in_one_reborn_db");

    // প্যাকেজ অনুযায়ী মেয়াদ (Expiry Date) হিসাব করা
    const daysToAdd = pkg === '6_months' ? 180 : 30;
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + daysToAdd);

    // ১. ইউজারকে প্রিমিয়াম করা এবং মেয়াদ সেট করা
    await db.collection("web_users").updateOne(
      { _id: new ObjectId(userId) },
      { 
        $set: { 
          isPremium: true, 
          premiumExpiry: expiryDate 
        } 
      }
    );

    // ২. পেমেন্ট রিকোয়েস্টকে Approved মার্ক করা
    await db.collection("pending_payments").updateOne(
      { _id: new ObjectId(paymentId) },
      { $set: { status: "approved", approvedAt: new Date() } }
    );

    return NextResponse.json({ message: "ইউজারকে সফলভাবে প্রিমিয়াম করা হয়েছে!", success: true });
  } catch (error) {
    return NextResponse.json({ message: "সার্ভার এরর!" }, { status: 500 });
  }
}
