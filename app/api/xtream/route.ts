// ফাইল পাথ: app/api/xtream/route.ts
import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';

// 🚀 এন্টারপ্রাইজ মেমোরি ক্যাশ
let STREAM_CACHE: any[] | null = null;
let CATEGORY_CACHE: any[] | null = null;
let CACHE_TIME = 0;
const CACHE_TTL = 5 * 60 * 1000; 
let AUTH_CACHE: Record<string, { valid: boolean; expiry: number; userId: string }> = {};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

export async function OPTIONS() {
  return new Response(null, { headers: corsHeaders });
}

// 🎯 GET ও POST উভয়ের জন্য একটি কমন হ্যান্ডেলার
async function handleXtreamRequest(req: Request) {
  try {
    const url = new URL(req.url);
    let username = url.searchParams.get('username') || ''; 
    let password = url.searchParams.get('password') || ''; 
    let action = url.searchParams.get('action') || '';

    // 🚀 ১. ম্যাজিক ফিক্স: প্লেয়ার যদি POST বডিতে ডাটা লুকিয়ে পাঠায়, তবে তা বের করা হবে
    if (req.method === 'POST') {
      try {
        const contentType = req.headers.get('content-type') || '';
        if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
          const formData = await req.formData();
          if (formData.has('username')) username = formData.get('username') as string;
          if (formData.has('password')) password = formData.get('password') as string;
          if (formData.has('action')) action = formData.get('action') as string;
        } else if (contentType.includes('application/json')) {
          const body = await req.json();
          if (body.username) username = body.username;
          if (body.password) password = body.password;
          if (body.action) action = body.action;
        }
      } catch (e) {
        // বডি পার্সিং ফেইল করলে ইগনোর করবে
      }
    }

    if (!username || !password) {
      return NextResponse.json({ message: "Missing credentials" }, { status: 400, headers: corsHeaders });
    }

    const client = await clientPromise;
    const db = client.db("all_in_one_reborn_db");
    const now = Date.now();

    // 🔐 ২. স্মার্ট অথেনটিকেশন চেক
    const cacheKey = `${username}_${password}`;
    let isUserValid = false;

    if (AUTH_CACHE[cacheKey] && AUTH_CACHE[cacheKey].expiry > now) {
      isUserValid = AUTH_CACHE[cacheKey].valid;
    } else {
      const user = await db.collection("web_users").findOne({ phone: username });
      let passwordMatch = false;

      if (user && user.password) {
        if (user.password.startsWith('$2a$') || user.password.startsWith('$2b$')) {
          passwordMatch = await bcrypt.compare(password, user.password);
        } else {
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
      return NextResponse.json({ user_info: { auth: 0, status: "Not Authorized" } }, { headers: corsHeaders });
    }

    // 🎯 ৩. মেমোরি ক্যাশ আপডেট (ডাটাবেস অপটিমাইজেশন)
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

      // ⚠️ যদি আপনার সার্ভারে কোনো চ্যানেল না থাকে, তবে একটি ডামি চ্যানেল দেওয়া হবে। নইলে প্লেয়ার ক্র্যাশ করবে!
      if (processedStreams.length === 0) {
        categoriesMap.add("Welcome");
        processedStreams.push({
          num: 1,
          name: "No Channels Available",
          stream_id: "dummy_stream",
          stream_icon: "",
          category_id: Buffer.from("Welcome").toString('base64').substring(0, 8),
          container_extension: "m3u8",
          custom_sid: "",
          tv_archive: 0
        });
      }

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

    // ১. লগইন হ্যান্ডেলার
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

    // ২. লাইভ ক্যাটাগরি ও স্ট্রিম
    if (action === 'get_live_categories') return NextResponse.json(CATEGORY_CACHE, { headers: corsHeaders });
    if (action === 'get_live_streams') return NextResponse.json(STREAM_CACHE, { headers: corsHeaders });

    // 🚀 ৪. VOD/Series প্যানিক ফিক্স: প্লেয়ার মুভি/সিরিজ খুঁজলে এরর না দিয়ে খালি ডাটা ([]) ধরিয়ে দেওয়া হবে!
    if (action === 'get_vod_categories' || action === 'get_series_categories' || action === 'get_vod_streams' || action === 'get_series') {
      return NextResponse.json([], { headers: corsHeaders });
    }

    return NextResponse.json({ message: "Action not supported" }, { status: 400, headers: corsHeaders });

  } catch (error) {
    console.error("Xtream API Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500, headers: corsHeaders });
  }
}

export async function GET(req: Request) { return handleXtreamRequest(req); }
export async function POST(req: Request) { return handleXtreamRequest(req); }
