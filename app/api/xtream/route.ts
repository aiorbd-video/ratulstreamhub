// ফাইল পাথ: app/api/xtream/route.ts
import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import bcrypt from 'bcryptjs'; // 🎯 নতুন যুক্ত করা হলো

export const dynamic = 'force-dynamic';

const generateId = (str: string) => {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
  }
  return Math.abs(hash);
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, Accept",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

async function handleRequest(req: Request) {
  try {
    const url = new URL(req.url);
    let username = url.searchParams.get('username');
    let password = url.searchParams.get('password');
    let action = url.searchParams.get('action');

    if (req.method === 'POST') {
      const contentType = req.headers.get('content-type') || '';
      try {
        if (contentType.includes('multipart/form-data')) {
          const formData = await req.formData();
          username = (formData.get('username') as string) || username;
          password = (formData.get('password') as string) || password;
          action = (formData.get('action') as string) || action;
        } else {
          const text = await req.text();
          const params = new URLSearchParams(text);
          username = params.get('username') || username;
          password = params.get('password') || password;
          action = params.get('action') || action;
        }
      } catch (e) {}
    }

    if (!username || !password) {
      return NextResponse.json({ user_info: { auth: 0 } }, { headers: corsHeaders });
    }

    const client = await clientPromise;
    const db = client.db("all_in_one_reborn_db");
    const user = await db.collection("web_users").findOne({ phone: username });

    // 🎯 ম্যাজিক ফিক্স: Bcrypt ডিক্রিপশন দিয়ে পাসওয়ার্ড চেক করা
    let isPasswordValid = false;
    if (user) {
      if (user.password) {
        // ডাটাবেসের হ্যাশ পাসওয়ার্ডের সাথে ইউজারের টাইপ করা পাসওয়ার্ড মেলাবে
        isPasswordValid = await bcrypt.compare(password, user.password);
      } else {
        // পাসওয়ার্ড সেট না থাকলে নাম্বার দিয়ে মেলাবে
        isPasswordValid = (password === username);
      }
    }

    if (!user || !isPasswordValid) {
      return NextResponse.json({ user_info: { auth: 0, status: "Incorrect Details" } }, { headers: corsHeaders });
    }

    const now = new Date();
    const isExpired = !user.isPremium || (user.premiumExpiry && new Date(user.premiumExpiry) < now);

    if (isExpired) {
      return NextResponse.json({ user_info: { auth: 0, status: "Expired" } }, { headers: corsHeaders });
    }

    if (!action) {
      return NextResponse.json({
        user_info: {
          username: user.phone,
          password: password,
          message: "Welcome VIP User",
          auth: 1,
          status: "Active",
          exp_date: user.premiumExpiry ? Math.floor(new Date(user.premiumExpiry).getTime() / 1000) : 1999999999,
          is_trial: user.hasUsedTrial ? 0 : 1,
          active_cons: 0,
          max_connections: 1,
          allowed_output_formats: ["m3u8", "ts"]
        },
        server_info: {
          url: url.hostname,
          port: "443",
          https_port: "443",
          server_protocol: "https",
          rtmp_port: "80",
          timezone: "Asia/Dhaka",
          timestamp_now: Math.floor(Date.now() / 1000),
          time_now: new Date().toLocaleString(),
        }
      }, { headers: corsHeaders });
    }

    if (action === 'get_live_categories') {
      const streams = await db.collection("posted_streams").find({}).toArray();
      const categoriesMap = new Map();

      streams.forEach(s => {
        const group = s.group || "Live TV";
        categoriesMap.set(group, generateId(group));
      });

      const mergedM3uDoc = await db.collection("system_settings").findOne({ key: "merged_premium_m3u" });
      if (mergedM3uDoc && mergedM3uDoc.content) {
        const matches = mergedM3uDoc.content.matchAll(/group-title="([^"]+)"/g);
        for (const match of matches) {
          categoriesMap.set(match[1], generateId(match[1]));
        }
      }

      if (categoriesMap.size === 0) categoriesMap.set("All Channels", 1);

      const categories = Array.from(categoriesMap, ([name, id]) => ({
        category_id: id.toString(),
        category_name: name,
        parent_id: 0
      }));
      return NextResponse.json(categories, { headers: corsHeaders });
    }

    if (action === 'get_live_streams') {
      const streams = await db.collection("posted_streams").find({}).toArray();
      const liveStreams: any[] = [];
      const processedUrls = new Set();

      streams.forEach(stream => {
        const rawUrl = stream.stream_url;
        if (!rawUrl || processedUrls.has(rawUrl)) return;
        processedUrls.add(rawUrl);

        let cleanTitle = (stream.title || "").replace(/tvg-[a-zA-Z0-9\-]+="[^"]*"/g, "").replace(/(https?:\/\/[^\s]+)/g, "").replace(/^[,-\s]+/, "").trim() || "Live TV";

        liveStreams.push({
          num: liveStreams.length + 1,
          name: cleanTitle,
          stream_type: "live",
          stream_id: generateId(rawUrl),
          stream_icon: stream.logo || "",
          epg_channel_id: "",
          added: "1",
          category_id: generateId(stream.group || "Live TV").toString(),
          custom_sid: "",
          tv_archive: 0,
          direct_source: "",
          tv_archive_duration: 0
        });
      });

      const mergedM3uDoc = await db.collection("system_settings").findOne({ key: "merged_premium_m3u" });
      if (mergedM3uDoc && mergedM3uDoc.content) {
        const lines = mergedM3uDoc.content.split('\n');
        let currentTitle = "Premium TV";
        let currentGroup = "Premium VIP";
        let currentLogo = "";

        for (let i = 0; i < lines.length; i++) {
          let line = lines[i].trim();
          if (line.startsWith('#EXTINF')) {
            const groupMatch = line.match(/group-title="([^"]+)"/);
            if (groupMatch) currentGroup = groupMatch[1];
            const logoMatch = line.match(/tvg-logo="([^"]+)"/);
            if (logoMatch) currentLogo = logoMatch[1];
            const titleSplit = line.split(',');
            if (titleSplit.length > 1) currentTitle = titleSplit.pop()?.trim() || "TV";
          } else if (line.startsWith('http')) {
            const cleanUrl = line.split('|')[0].trim();

            if (!processedUrls.has(cleanUrl)) {
              processedUrls.add(cleanUrl);
              liveStreams.push({
                num: liveStreams.length + 1,
                name: currentTitle,
                stream_type: "live",
                stream_id: generateId(cleanUrl),
                stream_icon: currentLogo,
                epg_channel_id: "",
                added: "1",
                category_id: generateId(currentGroup).toString(),
                custom_sid: "",
                tv_archive: 0,
                direct_source: "",
                tv_archive_duration: 0
              });
            }
            currentTitle = "Premium TV"; currentGroup = "Premium VIP"; currentLogo = "";
          }
        }
      }
      return NextResponse.json(liveStreams, { headers: corsHeaders });
    }

    if (action.includes('vod') || action.includes('series')) {
      if (action === 'get_vod_categories' || action === 'get_series_categories') {
        return NextResponse.json([{ category_id: "9999", category_name: "Movies/Series", parent_id: 0 }], { headers: corsHeaders });
      }
      return NextResponse.json([], { headers: corsHeaders });
    }

    return NextResponse.json([], { headers: corsHeaders });

  } catch (error) {
    return NextResponse.json([], { headers: corsHeaders });
  }
}

export async function GET(req: Request) { return handleRequest(req); }
export async function POST(req: Request) { return handleRequest(req); }
