// ফাইল পাথ: app/player_api.php/route.ts
import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

// 🚀 এন্টারপ্রাইজ মেমোরি ক্যাশ (মঙ্গোডিবি-কে হাতুড়ির আঘাত থেকে বাঁচানোর জন্য)
let STREAM_CACHE: any[] | null = null;
let CATEGORY_CACHE: any[] | null = null;
let CACHE_TIME = 0;
const CACHE_TTL = 5 * 60 * 1000; // ৫ মিনিট ডাটাবেস ক্যাশ থাকবে

// 🔐 ইউজার অথেনটিকেশন ক্যাশ (বারবার পাসওয়ার্ড হ্যাশ চেক করা রুখতে)
let AUTH_CACHE: Record<string, { valid: boolean; expiry: number; userId: string }> = {};

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const username = searchParams.get('username') || ''; // ইউজারের ফোন নাম্বার
    const password = searchParams.get('password') || ''; // ইউজারের পাসওয়ার্ড
    const action = searchParams.get('action') || '';

    if (!username || !password) {
      return NextResponse.json({ message: "Missing credentials" }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db("all_in_one_reborn_db");
    const now = Date.now();

    // 🎯 ১. স্মার্ট অথেনটিকেশন চেক (ডাটাবেস কুয়েরি সেভার)
    const cacheKey = `${username}_${password}`;
    let isUserValid = false;
    let cachedAuth = AUTH_CACHE[cacheKey];

    if (cachedAuth && cachedAuth.expiry > now) {
      isUserValid = cachedAuth.valid;
    } else {
      // ক্যাশে না থাকলে বা মেয়াদ শেষ হলে ডাটাবেস থেকে চেক করবে
      const user = await db.collection("web_users").findOne({ phone: username });
      
      // পাসওয়ার্ড ম্যাচিং (এখানে আপনার আগের প্লেন টেক্সট বা হ্যাশ লজিক অনুযায়ী মিলিয়ে নেবেন)
      const passwordMatch = user && user.password === password; 
      const hasPremium = user && user.isPremium && (!user.premiumExpiry || new Date(user.premiumExpiry) > new Date());

      isUserValid = !!(passwordMatch && hasPremium);
      
      // ১০ মিনিটের জন্য মেমোরিতে সেভ করে রাখবে
      AUTH_CACHE[cacheKey] = {
        valid: isUserValid,
        expiry: now + 10 * 60 * 1000,
        userId: user ? user._id.toString() : ''
      };
    }

    if (!isUserValid) {
      return NextResponse.json({ user_info: { auth: 0, status: "Not Authorized" } });
    }

    // 🎯 ২. মেমোরি থেকে স্ট্রিম ও ক্যাটাগরি ডাটা লোড (জিরো ডাটাবেস হিট)
    if (!STREAM_CACHE || !CATEGORY_CACHE || (now - CACHE_TIME) > CACHE_TTL) {
      const [streams, mergedM3uDoc] = await Promise.all([
        db.collection("posted_streams").find({}, { projection: { title: 1, group: 1, logo: 1, stream_url: 1 } }).toArray(),
        db.collection("system_settings").findOne({ key: "merged_premium_m3u" }, { projection: { content: 1 } })
      ]);

      // ক্যাটাগরি ও স্ট্রিম লিস্ট প্রসেসিং
      const categoriesMap = new Set<string>();
      const processedStreams: any[] = [];
      let globalIdCounter = 1000;

      // posted_streams থেকে ডাটা প্রসেস
      streams.forEach((stream) => {
        const groupName = stream.group || "Live TV";
        categoriesMap.add(groupName);
        processedStreams.push({
          num: globalIdCounter++,
          name: stream.title || "Live TV",
          stream_id: stream._id.toString(),
          stream_icon: stream.logo || "",
          category_id: Buffer.from(groupName).toString('base64').substring(0, 8),
          container_extension: "m3u8",
          custom_sid: "",
          tv_archive: 0
        });
      });

      // মার্জড M3U টেক্সট থেকে ডাটা পার্সিং ও ক্যাটাগরি তৈরি
      if (mergedM3uDoc && mergedM3uDoc.content) {
        const lines = mergedM3uDoc.content.split(/\r?\n/);
        let currentTitle = "Live TV";
        let currentGroup = "VIP Channels";
        let currentLogo = "";

        for (let line of lines) {
          line = line.trim();
          if (line.startsWith('#EXTINF')) {
            const groupMatch = line.match(/group-title="([^"]+)"/);
            const logoMatch = line.match(/tvg-logo="([^"]+)"/);
            currentGroup = groupMatch ? groupMatch[1] : "VIP Channels";
            currentLogo = logoMatch ? logoMatch[1] : "";
            
            const titleParts = line.split(',');
            currentTitle = titleParts[titleParts.length - 1].trim();
            categoriesMap.add(currentGroup);
          } else if (line.startsWith('http')) {
            processedStreams.push({
              num: globalIdCounter++,
              name: currentTitle,
              stream_id: Buffer.from(line).toString('base64').substring(0, 12), // লিংকের আইডি মাস্কিং
              stream_icon: currentLogo,
              category_id: Buffer.from(currentGroup).toString('base64').substring(0, 8),
              container_extension: "m3u8",
              custom_sid: "",
              tv_archive: 0
            });
          }
        }
      }

      // ক্যাটাগরি ফরম্যাট জেনারেট
      const processedCategories = Array.from(categoriesMap).map((catName) => ({
        category_id: Buffer.from(catName).toString('base64').substring(0, 8),
        category_name: catName,
        parent_id: 0
      }));

      STREAM_CACHE = processedStreams;
      CATEGORY_CACHE = processedCategories;
      CACHE_TIME = now;
    }

    // 🎯 ৩. এক্সট্রিম কোডস অ্যাকশন রেসপন্স হ্যান্ডেলার
    const host = req.headers.get('host') || 'localhost';
    const protocol = req.headers.get('x-forwarded-proto') || 'https';
    const baseUrl = `${protocol}://${host}`;

    // হ্যান্ডশেক/লগইন অ্যাকশন
    if (!action) {
      return NextResponse.json({
        user_info: {
          username: username,
          password: password,
          auth: 1,
          status: "Active",
          exp_date: "1799345858", // আনলিমিটেড বা লং টাইম এক্সপায়ারি
          is_trial: "0",
          active_cons: "0",
          max_connections: "2"
        },
        server_info: {
          url: host,
          port: "80",
          https_port: "443",
          server_protocol: protocol,
          rtmp_port: "80",
          timezone: "Asia/Dhaka"
        }
      });
    }

    if (action === 'get_live_categories') {
      return NextResponse.json(CATEGORY_CACHE);
    }

    if (action === 'get_live_streams') {
      return NextResponse.json(STREAM_CACHE);
    }

    return NextResponse.json({ message: "Action not supported" }, { status: 400 });

  } catch (error) {
    console.error("Xtream API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
  }
