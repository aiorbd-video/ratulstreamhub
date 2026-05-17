// ফাইল পাথ: app/api/watch/[id]/route.ts
import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const client = await clientPromise;
    const db = client.db("all_in_one_reborn_db");

    // ১. posted_streams থেকে স্ট্রিম লিংক আনা
    const stream = await db.collection("posted_streams").findOne({ short_id: params.id });
    if (!stream) {
      return NextResponse.json({ success: false, message: "Stream not found" }, { status: 404 });
    }

    // ২. short_links থেকে সিকিউরিটি হেডারগুলো (Cookie, User-Agent) আনা
    const linkData = await db.collection("short_links").findOne({ short_id: params.id });

    return NextResponse.json({
      success: true,
      title: stream.title,
      streamUrl: stream.stream_url,
      logo: stream.logo || "https://placehold.co/600x400/1e293b/ef4444?text=LIVE+TV",
      headers: {
        referer: linkData?.referer || "",
        origin: linkData?.origin || "",
        cookie: linkData?.cookie || "",
        userAgent: linkData?.user_agent || ""
      }
    });

  } catch (error) {
    return NextResponse.json({ success: false, message: "Server Error" }, { status: 500 });
  }
}
