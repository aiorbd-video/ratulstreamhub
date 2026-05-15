// ফাইল পাথ: app/api/streams/route.ts
import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb'; // ৩ ধাপ পেছনে গিয়ে lib ফোল্ডার খুঁজে নেবে

export const dynamic = 'force-dynamic'; 

export async function GET() {
    try {
        const client = await clientPromise;
        const db = client.db("all_in_one_reborn_db");
        
        // posted_streams থেকে সব লাইভ স্ট্রিম টেনে আনা হচ্ছে
        const streams = await db
            .collection("posted_streams")
            .find({})
            .sort({ posted_at: -1 }) // নতুন পোস্ট আগে দেখাবে
            .toArray();

        return NextResponse.json({ 
            success: true, 
            count: streams.length,
            streams 
        });
    } catch (error) {
        console.error("Database Error:", error);
        return NextResponse.json({ 
            success: false, 
            error: 'Database connection failed' 
        }, { status: 500 });
    }
}
