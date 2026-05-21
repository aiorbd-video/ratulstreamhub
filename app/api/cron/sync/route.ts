// ফাইল পাথ: app/api/cron/sync/route.ts
import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const client = await clientPromise;
    const db = client.db("all_in_one_reborn_db");

    // ১. ডাটাবেস থেকে আগে সেভ করা M3U লিংকগুলো (URLs) বের করা
    const urlDoc = await db.collection("system_settings").findOne({ key: "m3u_urls" });
    const urls = urlDoc?.urls || [];

    if (!urls || urls.length === 0) {
      return NextResponse.json({ success: false, message: "No URLs found to sync" });
    }

    // ২. লিংকগুলো থেকে নতুন টোকেনসহ ফ্রেশ ডাটা ফেচ করা (Cache বাদে)
    const fetchPromises = urls.map(async (url: string) => {
      try {
        const res = await fetch(url.trim(), { 
          cache: 'no-store', // 🎯 Vercel যেন পুরনো ক্যাশ না দেয়
          next: { revalidate: 0 } 
        });
        
        if (res.ok) {
          let text = await res.text();
          
          // 🚀 সেই আল্টিমেট অটো-ক্লিনার ম্যাজিক
          let autoCleanedText = text
            .replace(/(#EXTINF)/gi, "\n$1")
            .replace(/(#EXTVLCOPT)/gi, "\n$1")
            .replace(/(#EXTHTTP)/gi, "\n$1")
            .replace(/(^|[^\w#])(EXTVLCOPT|EXTHTTP)/gi, "$1\n#$2")
            .replace(/([^"'\s=])(https?:\/\/)/gi, "$1\n$2")
            .replace(/\n+/g, "\n");

          return `\n# --- Auto Synced: ${new Date().toISOString()} ---\n` + autoCleanedText.replace(/#EXTM3U.*\n/g, "").trim();
        }
        return "";
      } catch (e) {
        return "";
      }
    });

    const results = await Promise.all(fetchPromises);
    const mergedContent = results.join("\n\n");

    // ৩. নতুন টোকেনের ডাটাগুলো মেইন ফাইলে রিপ্লেস করে দেওয়া
    await db.collection("system_settings").updateOne(
      { key: "merged_premium_m3u" },
      { $set: { content: mergedContent, updatedAt: new Date() } },
      { upsert: true }
    );

    return NextResponse.json({ success: true, message: "Background Auto-Sync Completed!" });

  } catch (error) {
    return NextResponse.json({ success: false, message: "Server Error!" }, { status: 500 });
  }
}
