// ফাইল পাথ: app/api/stream/[id]/route.ts
import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb'; // পাথটি চেক করে নেবেন

export async function GET(request: Request, { params }: { params: { id: string } }) {
    try {
        const client = await clientPromise;
        const db = client.db("all_in_one_reborn_db");
        
        // short_id দিয়ে নির্দিষ্ট চ্যানেলটি খোঁজা হচ্ছে
        const stream = await db.collection("posted_streams").findOne({ short_id: params.id });

        if (!stream) {
            return NextResponse.json({ success: false, error: 'Stream not found' }, { status: 404 });
        }
        return NextResponse.json({ success: true, stream });
    } catch (error) {
        return NextResponse.json({ success: false, error: 'Database error' }, { status: 500 });
    }
}
