// ফাইল পাথ: app/api/playlist/[id]/route.ts
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const client = await clientPromise;
    const db = client.db("all_in_one_reborn_db");

    // ১. ইউজারকে তার আইডি (ID) দিয়ে ডাটাবেসে খোঁজা
    const user = await db.collection("web_users").findOne({ _id: new ObjectId(params.id) });

    // যদি ইউজার না থাকে
    if (!user) {
      return new Response("#EXTM3U\n#EXTINF:-1, ❌ Invalid User\nhttp://error.local", { status: 404 });
    }

    // ২. ইউজারের প্রিমিয়াম মেয়াদ চেক করা
    const now = new Date();
    if (!user.isPremium || (user.premiumExpiry && new Date(user.premiumExpiry) < now)) {
      
      // মেয়াদ শেষ হলে ডাটাবেসে তাকে অটোমেটিক ফ্রি ইউজার বানিয়ে দেওয়া হবে
      if (user.isPremium) {
        await db.collection("web_users").updateOne({ _id: new ObjectId(params.id) }, { $set: { isPremium: false } });
      }

      // মেয়াদ শেষ হলে প্লেয়ারে এই মেসেজটি দেখাবে
      return new Response("#EXTM3U\n#EXTINF:-1 tvg-logo=\"https://placehold.co/600x400/000/f00?text=Expired\", 🚫 Subscription Expired! Please Renew.\nhttp://expired.local", {
        headers: { "Content-Type": "application/vnd.apple.mpegurl" }
      });
    }

    // ৩. ইউজারের মেয়াদ থাকলে ডাটাবেস থেকে সব স্ট্রিম নিয়ে আসা
    const streams = await db.collection("posted_streams").find({}).toArray();

    // ৪. ডাইনামিক M3U ফাইল তৈরি করা
    let m3uContent = "#EXTM3U x-tvg-url=\"\"\n";

    streams.forEach(stream => {
      let rawTitle = stream.title || "";
      let logo = "";

      // লোগো বের করা
      const logoMatch = rawTitle.match(/tvg-logo="([^"]+)"/);
      if (logoMatch) logo = logoMatch[1];
      else logo = "https://placehold.co/600x400/1e293b/ef4444?text=LIVE+TV";

      // টাইটেল ক্লিন করা
      rawTitle = rawTitle.replace(/tvg-[a-zA-Z0-9\-]+="[^"]*"/g, "");
      rawTitle = rawTitle.replace(/(https?:\/\/[^\s]+)/g, "");
      let cleanTitle = rawTitle.replace(/^[,-\s]+/, "").trim() || "Live TV";

      const url = stream.stream_url;

      if (url) {
        // IPTV এর জন্য পারফেক্ট ফরম্যাট
        m3uContent += `#EXTINF:-1 tvg-logo="${logo}" group-title="All In One Reborn VIP", ${cleanTitle}\n`;
        m3uContent += `${url}\n`;
      }
    });

    // ৫. প্লেলিস্ট ফাইল হিসেবে ইউজারের কাছে পাঠানো
    return new Response(m3uContent, {
      headers: {
        "Content-Type": "application/vnd.apple.mpegurl",
        "Content-Disposition": `attachment; filename="Reborn_VIP_${user.phone}.m3u"`
      }
    });

  } catch (error) {
    return new Response("#EXTM3U\n#EXTINF:-1, ❌ Server Error\nhttp://error.local", { status: 500 });
  }
}
