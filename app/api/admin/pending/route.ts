// ফাইল পাথ: app/api/admin/pending/route.ts
import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const client = await clientPromise;
    const db = client.db("all_in_one_reborn_db");
    
    // শুধু পেন্ডিং রিকোয়েস্টগুলো বের করে আনা হবে
    const pendingReqs = await db.collection("pending_payments").find({ status: "pending" }).sort({ submittedAt: -1 }).toArray();
    
    return NextResponse.json({ success: true, requests: pendingReqs });
  } catch (error) {
    return NextResponse.json({ success: false, error: "Database error" }, { status: 500 });
  }
}
