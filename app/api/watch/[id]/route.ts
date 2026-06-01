import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb'; // আপনার mongodb কানেকশন ফাইল

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const client = await clientPromise;
    const db = client.db("all_in_one_reborn_db");
    
    // ডাটাবেস থেকে লিংকের আইডি দিয়ে ডেটা খোঁজা
    const data = await db.collection("short_links").findOne({ short_id: params.id });

    if (!data) {
      return NextResponse.json({ success: false, message: 'Stream not found' });
    }

    // 🎯 প্লেয়ারের কাছে ডাটাবেস থেকে সব ডেটা পাঠানো হচ্ছে
    return NextResponse.json({
      success: true,
      streamUrl: data.stream_url,
      title: data.title || "Live Stream",
      logo: data.logo || "",
      headers: {
        referer: data.referer || "",
        origin: data.origin || "",
        cookie: data.cookie || "",
        userAgent: data.user_agent || ""
      },
      stream_type: data.stream_type || "hls",
      drm_key_id: data.drm_key_id || "",
      drm_key: data.drm_key || "",
      start_time: data.start_time || "",
      end_time: data.end_time || "",
      proxy_url: data.proxy_url || "" // 🚨 এই লাইনটাই মিসিং ছিল!
    });

  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json({ success: false, message: 'Server error' }, { status: 500 });
  }
}
