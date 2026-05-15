// ফাইল পাথ: app/api/stream/[id]/route.ts
import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

// 🎯 Next.js 15/16 এর নতুন নিয়ম অনুযায়ী params কে Promise হিসেবে দেওয়া হলো
export async function GET(
    request: Request, 
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        // 🎯 params কে await করে id বের করে নিতে হবে
        const resolvedParams = await params; 
        
        const client = await clientPromise;
        const db = client.db("all_in_one_reborn_db");
        
        const stream = await db.collection("posted_streams").findOne({ short_id: resolvedParams.id });

        if (!stream) {
            return NextResponse.json({ success: false, error: 'Stream not found' }, { status: 404 });
        }
        return NextResponse.json({ success: true, stream });
    } catch (error) {
        return NextResponse.json({ success: false, error: 'Database error' }, { status: 500 });
    }
}
