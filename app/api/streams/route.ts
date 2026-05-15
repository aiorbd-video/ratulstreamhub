// ফাইল পাথ: app/api/streams/route.ts
import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const client = await clientPromise;
        
        // আপনার বটের আসল ডেটাবেস নাম (প্রয়োজনে আপনার বটের নাম অনুযায়ী পরিবর্তন করতে পারেন)
        const db = client.db("all_in_one_reborn_db");
        
        // ভুল "posted_col" এর বদলে আসল নাম "posted_streams" দেওয়া হলো
        const streams = await db
            .collection("posted_streams") 
            .find({})
            .sort({ posted_at: -1 }) // নতুন লিংক আগে দেখাবে
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
