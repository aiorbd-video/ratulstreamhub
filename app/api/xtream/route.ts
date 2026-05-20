// ফাইল পাথ: app/api/xtream/route.ts
import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';

// 🚀 এন্টারপ্রাইজ মেমোরি ক্যাশ
let STREAM_CACHE: any[] | null = null;
let CATEGORY_CACHE: any[] | null = null;
let CACHE_TIME = 0;
const CACHE_TTL = 5 * 60 * 1000; // ৫ মিনিট ক্যাশ
let AUTH_CACHE: Record<string, { valid: boolean; expiry: number; userId: string }> = {};

// 🎯 CORS হেডার (যেকোনো প্লেয়ারের জন্য অ্যালাউড)
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const username = searchParams.get('username') || ''; 
    const password = searchParams.get('password') || ''; 
    const action = searchParams.get('action') || '';

    if (!username || !password) {
      return NextResponse.json({ message: "Missing credentials" }, { status: 400, headers: corsHeaders });
    }

    const client = await clientPromise;
    const db = client.db("all_in_one_reborn_db");
    const now = Date.now();

    // 🔐 স্মার্ট অথেনটিকেশন চেক (Bcrypt Fallback সহ)
    const cacheKey = `${username}_${password}`;
    let isUserValid = false;

    if (AUTH_CACHE[cacheKey] && AUTH_CACHE[cacheKey].expiry > now) {
      isUserValid = AUTH_CACHE[cacheKey].valid;
    } else {
      const user = await db.collection("web_users").findOne({ phone: username });
      let passwordMatch = false;

      if (user && user.password) {
        // যদি পাসওয়ার্ড হ্যাশ করা থাকে ($2a$ বা $2b$), তাহলে bcrypt দিয়ে চেক করবে
        if (user.password.startsWith('$2a$') || user.password.startsWith('$2b$')) {
          passwordMatch = await bcrypt.compare(password, user.password);
        } else {
          // পুরনো ইউজারদের নরমাল পাসওয়ার্ডের জন্য
          passwordMatch = user.password === password;
        }
      }
      
      const hasPremium = user && user.isPremium && (!user.premiumExpiry || new Date(user.premiumExpiry) > new Date());
      isUserValid = !!(passwordMatch && hasPremium);
      
      AUTH_CACHE[cacheKey] = {
        valid: isUserValid,
        expiry: now + 5 * 60 * 1000,
        userId: user ? user._id.toString() : ''
      };
    }

    if (!isUserValid) {
      // 🚫 প্লেয়ারকে লগইন ফেইলড মেসেজ দেওয়া হচ্ছে
      return NextResponse.json({ user_info: { auth: 0, status: "Not Authorized" } }, { headers: corsHeaders });
    }

    // 🎯 মেমোরি থেকে ডাটা লোড
    if (!STREAM_CACHE || !CATEGORY_CACHE || (now - CACHE_TIME) > CACHE_TTL) {
      const [streams, mergedM3uDoc] = await Promise.all([
        db.collection("posted_streams").find({}, { projection: { title: 1, group: 1, logo: 1, stream_url: 1 } }).toArray(),
        db.collection("system_settings").findOne({ key: "merged_premium_m3u" }, { projection: { content: 1 } })
      ]);

      const categoriesMap = new Set<string>();
      const processedStreams: any[] = [];
      let globalIdCounter = 1000;

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
              stream_id: Buffer.from(line).toString('base64').substring(0, 12),
              stream_icon: currentLogo,
              category_id: Buffer.from(currentGroup).toString('base64').substring(0, 8),
              container_extension: "m3u8",
              custom_sid: "",
              tv_archive: 0
            });
          }
        }
      }

      // যদি ডাটাবেস একদম ফাঁকা থাকে, তবে একটি ডামি ক্যাটাগরি পাঠানো হবে যাতে "Playlist not found" না আসে
      if (categoriesMap.size === 0) categoriesMap.add("No Channels Available");

      const processedCategories = Array.from(categoriesMap).map((catName) => ({
        category_id: Buffer.from(catName).toString('base64').substring(0, 8),
        category_name: catName,
        parent_id: 0
      }));

      STREAM_CACHE = processedStreams;
      CATEGORY_CACHE = processedCategories;
      CACHE_TIME = now;
    }

    const host = req.headers.get('host') || 'localhost';
    const protocol = req.headers.get('x-forwarded-proto') || 'https';

    // ১. লগইন রিকোয়েস্ট
    if (!action) {
      return NextResponse.json({
        user_info: {
          username: username,
          password: password,
          auth: 1,
          status: "Active",
          exp_date: "1799345858", 
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
      }, { headers: corsHeaders });
    }

    // ২. ক্যাটাগরি রিকোয়েস্ট
    if (action === 'get_live_categories') {
      return NextResponse.json(CATEGORY_CACHE, { headers: corsHeaders });
    }

    // ৩. স্ট্রিম রিকোয়েস্ট
    if (action === 'get_live_streams') {
      return NextResponse.json(STREAM_CACHE, { headers: corsHeaders });
    }

    return NextResponse.json({ message: "Action not supported" }, { status: 400, headers: corsHeaders });

  } catch (error) {
    console.error("Xtream API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500, headers: corsHeaders });
  }
}

// 🎯 কিছু কড়া আইপিটিভি প্লেয়ার POST রিকোয়েস্ট পাঠায়, তার জন্য এই ফলব্যাক
export async function POST(req: Request) {
  return GET(req);
              }
