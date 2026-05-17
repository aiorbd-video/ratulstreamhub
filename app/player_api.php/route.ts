// ফাইল পাথ: app/player_api.php/route.ts
import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

const generateId = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = Math.imul(31, hash) + str.charCodeAt(i) | 0;
  return Math.abs(hash);
};

// 🛡️ CORS Headers
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

    // 🎯 ম্যাজিক ফিক্স ২: IPTV Smarters এর x-www-form-urlencoded ডাটা ১০০% সঠিকভাবে পার্স করা
    if (req.method === 'POST') {
      try {
        const text = await req.text();
        const params = new URLSearchParams(text);
        if (params.get('username')) username = params.get('username');
        if (params.get('password')) password = params.get('password');
        if (params.get('action')) action = params.get('action');
      } catch (e) {}
    }

    if (!username || !password) {
      return NextResponse.json({ user_info: { auth: 0 } }, { headers: corsHeaders });
    }

    const client = await clientPromise;
    const db = client.db("all_in_one_reborn_db");

    const user = await db.collection("web_users").findOne({ phone: username });
    
    // ফোন নাম্বারকেই পাসওয়ার্ড হিসেবে কাজ করানোর লজিক
    if (!user || (user.password ? user.password !== password : password !== username)) {
      return NextResponse.json({ user_info: { auth: 0, status: "Incorrect Details" } }, { headers: corsHeaders });
    }

    const now = new Date();
    const isExpired = !user.isPremium || (user.premiumExpiry && new Date(user.premiumExpiry) < now);
    
    if (isExpired) {
      return NextResponse.json({ user_info: { auth: 0, status: "Expired" } }, { headers: corsHeaders });
    }

    // 🎯 ম্যাজিক ফিক্স ১: এখান থেকে IP Lock সরিয়ে দেওয়া হয়েছে। (আইপি লক শুধুমাত্র /live/... ফাইলে থাকবে, যাতে প্লেলিস্ট স্মুথলি লোড হয়)

    if (!action) {
      return NextResponse.json({
        user_info: {
          username: user.phone,
          password: password,
          message: "Welcome to All In One Reborn VIP",
          auth: 1,
          status: "Active",
          exp_date: user.premiumExpiry ? Math.floor(new Date(user.premiumExpiry).getTime() / 1000) : "1999999999",
          is_trial: user.hasUsedTrial ? "0" : "1",
          active_cons: 1,
          max_connections: 1
        },
        server_info: {
          url: "ratulstreamhub.vercel.app",
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

      const categories = Array.from(categoriesMap, ([name, id]) => ({ category_id: id.toString(), category_name: name, parent_id: 0 }));
      return NextResponse.json(categories, { headers: corsHeaders });
    }

    if (action === 'get_live_streams') {
      const streams = await db.collection("posted_streams").find({}).toArray();
      const liveStreams: any[] = [];
      
      streams.forEach(stream => {
        let cleanTitle = (stream.title || "").replace(/tvg-[a-zA-Z0-9\-]+="[^"]*"/g, "").replace(/(https?:\/\/[^\s]+)/g, "").replace(/^[,-\s]+/, "").trim() || "Live TV";
        
        liveStreams.push({
          num: liveStreams.length + 1,
          name: cleanTitle,
          stream_type: "live",
          stream_id: generateId(stream.stream_url),
          stream_icon: stream.logo || "",
          epg_channel_id: null,
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
            liveStreams.push({
              num: liveStreams.length + 1,
              name: currentTitle,
              stream_type: "live",
              stream_id: generateId(line.split('|')[0]), 
              stream_icon: currentLogo,
              epg_channel_id: null,
              added: "1",
              category_id: generateId(currentGroup).toString(),
              custom_sid: "",
              tv_archive: 0,
              direct_source: "",
              tv_archive_duration: 0
            });
          }
        }
      }
      return NextResponse.json(liveStreams, { headers: corsHeaders });
    }

    // 🎯 ম্যাজিক ফিক্স ৩: মুভি বা সিরিজের রিকোয়েস্ট আসলে যেন প্লেয়ার ক্র্যাশ না করে, তার জন্য খালি Array পাঠানো হলো।
    return NextResponse.json([], { headers: corsHeaders });

  } catch (error) {
    return NextResponse.json({ user_info: { auth: 0, status: "Server Error" } }, { status: 500, headers: corsHeaders });
  }
}

export async function GET(req: Request) { return handleRequest(req); }
export async function POST(req: Request) { return handleRequest(req); }
