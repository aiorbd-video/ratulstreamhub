// ফাইল পাথ: app/api/admin/m3u-sync/route.ts
import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

export async function POST(req: Request) {
  try {
    const { urls } = await req.json(); // অ্যাডমিন প্যানেল থেকে লিংকগুলো আসবে
    if (!urls || urls.length === 0) {
      return NextResponse.json({ message: "কোনো লিংক দেওয়া হয়নি!" }, { status: 400 });
    }

    // সবগুলো লিংক থেকে একসাথে ডেটা আনার জন্য Promise.all ব্যবহার (যাতে দ্রুত হয়)
    const fetchPromises = urls.map(async (url: string) => {
      try {
        const res = await fetch(url.trim(), { next: { revalidate: 0 } });
        if (res.ok) {
          let text = await res.text();
          // ফাইলের ভেতরের #EXTM3U হেডার রিমুভ করা হচ্ছে, যাতে মার্জ করলে ফাইল ক্র্যাশ না করে
          return `\n# --- Premium Source: ${url} ---\n` + text.replace(/#EXTM3U.*\n/g, "");
        }
        return "";
      } catch (e) {
        return ""; // লিংক কাজ না করলে স্কিপ করবে
      }
    });

    const results = await Promise.all(fetchPromises);
    const mergedContent = results.join("\n");

    const client = await clientPromise;
    const db = client.db("all_in_one_reborn_db");

    // মার্জ করা বিশাল ফাইলটি ডাটাবেসে সেভ করা হচ্ছে
    await db.collection("system_settings").updateOne(
      { key: "merged_premium_m3u" },
      { $set: { key: "merged_premium_m3u", content: mergedContent, updatedAt: new Date() } },
      { upsert: true }
    );

    return NextResponse.json({ success: true, message: "সবগুলো M3U সফলভাবে মার্জ হয়ে সেভ হয়েছে!" });
  } catch (error) {
    return NextResponse.json({ success: false, message: "সার্ভার এরর!" }, { status: 500 });
  }
}
