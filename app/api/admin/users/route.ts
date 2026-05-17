// ফাইল পাথ: app/api/admin/users/route.ts
import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const client = await clientPromise;
    const db = client.db("all_in_one_reborn_db");
    
    // ডাটাবেস থেকে সব ইউজারকে আনা হচ্ছে
    const users = await db.collection("web_users").find({}).sort({ createdAt: -1 }).toArray();
    
    return NextResponse.json({ success: true, users });
  } catch (error) {
    return NextResponse.json({ success: false, error: "Database error" }, { status: 500 });
  }
}
