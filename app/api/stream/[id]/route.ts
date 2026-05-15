// ফাইল পাথ: app/api/stream/[id]/route.ts
import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

export const dynamic = 'force-dynamic'; // 🎯 Vercel কে বলে দেওয়া হলো যেন ক্যাশ না করে

export async function GET(
    request: Request, 
    { params }: { params: Promise<{ id: string }> }
) {
    try {
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
