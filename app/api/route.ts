// ফাইল পাথ: app/api/streams/route.ts
import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb'; 

export const dynamic = 'force-dynamic'; 

export async function GET() {
    try {
        const client = await clientPromise;
        
        // আপনার বটের আসল ডেটাবেস নাম (প্রয়োজনে আপনার বটের নাম অনুযায়ী পরিবর্তন করতে পারেন)
        const db = client.db("all_in_one_reborn_db");
        
        // এখানে আপনার বটের কালেকশনের নাম দেওয়া হয়েছে। 
        // আপনার বটের কোড অনুযায়ী এটি 'posted_col' অথবা 'links_col' হতে পারে।
        // নিচে তিনটির যেকোনো একটি সক্রিয় (uncomment) করে চেক করতে পারেন। বর্তমানে 'posted_col' দেওয়া আছে।
        const streams = await db
            .collection("posted_col") 
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
