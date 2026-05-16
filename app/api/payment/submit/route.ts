// ফাইল পাথ: app/api/payment/submit/route.ts
import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const { package: pkg, method, senderNumber, trxId, userId, phone } = data;

    if (!userId || !trxId || !senderNumber) {
      return NextResponse.json({ message: "অসম্পূর্ণ তথ্য!" }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db("all_in_one_reborn_db");

    // চেক করা যে একই TrxID দিয়ে আগে রিকোয়েস্ট করা হয়েছে কিনা
    const existingReq = await db.collection("pending_payments").findOne({ trxId });
    if (existingReq) {
      return NextResponse.json({ message: "এই TrxID দিয়ে আগেই পেমেন্ট সাবমিট করা হয়েছে!" }, { status: 400 });
    }

    // নতুন পেমেন্ট রিকোয়েস্ট সেভ করা
    await db.collection("pending_payments").insertOne({
      userId,
      phone,
      package: pkg,
      method,
      senderNumber,
      trxId,
      status: "pending",
      submittedAt: new Date(),
    });

    return NextResponse.json({ message: "পেমেন্ট রিকোয়েস্ট সাবমিট হয়েছে!", success: true }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ message: "সার্ভারে কোনো সমস্যা হয়েছে!" }, { status: 500 });
  }
}
