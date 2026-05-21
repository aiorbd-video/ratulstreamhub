// ফাইল পাথ: app/api/admin/m3u-sync/route.ts
import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

// 🎯 সেভ করা লিংকগুলো দেখার জন্য GET রিকোয়েস্ট
export async function GET() {
  try {
    const client = await clientPromise;
    const db = client.db("all_in_one_reborn_db");
    const doc = await db.collection("system_settings").findOne({ key: "m3u_urls" });
    return NextResponse.json({ urls: doc?.urls || [] });
  } catch (error) {
    return NextResponse.json({ urls: [] });
  }
}

// 🎯 নতুন করে সিংক এবং অটো-ক্লিন করার জন্য POST রিকোয়েস্ট
export async function POST(req: Request) {
  try {
    const { urls } = await req.json();

    const client = await clientPromise;
    const db = client.db("all_in_one_reborn_db");

    // ১. লিংকগুলোকে ডাটাবেসে সেভ রাখা হচ্ছে (যাতে পরে এডিট/ডিলিট করা যায়)
    await db.collection("system_settings").updateOne(
      { key: "m3u_urls" },
      { $set: { urls, updatedAt: new Date() } },
      { upsert: true }
    );

    if (!urls || urls.length === 0) {
      await db.collection("system_settings").updateOne({ key: "merged_premium_m3u" }, { $set: { content: "" } });
      return NextResponse.json({ success: true, message: "সব M3U লিংক ডিলিট করা হয়েছে!" });
    }

    // ২. লিংকগুলো ফেচ করা এবং অটোমেটিক জঞ্জাল ডাটা ক্লিন করা (The Magic Auto-Sanitizer)
    const fetchPromises = urls.map(async (url: string) => {
      try {
        const res = await fetch(url.trim(), { next: { revalidate: 0 } });
        if (res.ok) {
          let text = await res.text();
          
          // 🚀 ম্যাজিক ক্লিনার: এখানে জোড়া লাগা বা ভুল ফরম্যাটের ডাটা স্বয়ংক্রিয়ভাবে ফিক্স হয়ে যাবে
          let autoCleanedText = text
            .replace(/(#EXTINF)/gi, "\n$1")
            .replace(/(#EXTVLCOPT)/gi, "\n$1")
            .replace(/(#EXTHTTP)/gi, "\n$1")
            .replace(/(^|[^\w#])(EXTVLCOPT|EXTHTTP)/gi, "$1\n#$2")
            .replace(/([^"'\s=])(https?:\/\/)/gi, "$1\n$2") // রেফারের সাথে মেইন লিংক জোড়া থাকলে ভাঙবে
            .replace(/\n+/g, "\n"); // অতিরিক্ত ফাঁকা লাইন বাদ দেবে

          // আগের ফিক্স করা রুলস অনুযায়ী #EXTM3U বাদ দিয়ে ক্লিন ডাটা পাঠাবে
          return `\n# --- Premium Source: ${url} ---\n` + autoCleanedText.replace(/#EXTM3U.*\n/g, "").trim();
        }
        return "";
      } catch (e) {
        return "";
      }
    });

    const results = await Promise.all(fetchPromises);
    const mergedContent = results.join("\n\n");

    // ৩. মার্জ এবং ক্লিন করা বিশাল ফাইলটি ডাটাবেসে সেভ করা
    await db.collection("system_settings").updateOne(
      { key: "merged_premium_m3u" },
      { $set: { content: mergedContent, updatedAt: new Date() } },
      { upsert: true }
    );

    return NextResponse.json({ success: true, message: "M3U সফলভাবে অটো-ক্লিন, মার্জ এবং সেভ হয়েছে!" });
  } catch (error) {
    return NextResponse.json({ success: false, message: "সার্ভার এরর!" }, { status: 500 });
  }
}
