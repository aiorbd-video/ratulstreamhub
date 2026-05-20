// ফাইল পাথ: app/api/xtream/route.ts
import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';

function getNumericId(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) || 1;
}

let STREAM_CACHE: any[] | null = null;
let CATEGORY_CACHE: any[] | null = null;
let CACHE_TIME = 0;
const CACHE_TTL = 5 * 60 * 1000; 
let AUTH_CACHE: Record<string, { valid: boolean; expiry: number; userId: string; userObj: any }> = {};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

export async function OPTIONS() { return new Response(null, { headers: corsHeaders }); }

async function handleXtreamRequest(req: Request) {
  try {
    const url = new URL(req.url);
    let username = url.searchParams.get('username') || ''; 
    let password = url.searchParams.get('password') || ''; 
    let action = url.searchParams.get('action') || '';

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
      } catch (e) {}
    }

    if (!username || !password) return NextResponse.json({ user_info: { auth: 0, status: "Not Authorized" } }, { headers: corsHeaders });

    const client = await clientPromise;
    const db = client.db("all_in_one_reborn_db");
    const now = Date.now();
    const cacheKey = `${username}_${password}`;
    
    let isUserValid = false;
    let userData = null;

    if (AUTH_CACHE[cacheKey] && AUTH_CACHE[cacheKey].expiry > now) {
      isUserValid = AUTH_CACHE[cacheKey].valid;
      userData = AUTH_CACHE[cacheKey].userObj;
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
      userData = user;
      
      AUTH_CACHE[cacheKey] = { valid: isUserValid, expiry: now + 5 * 60 * 1000, userId: user ? user._id.toString() : '', userObj: user };
    }

    if (!isUserValid) return NextResponse.json({ user_info: { auth: 0, status: "Not Authorized" } }, { headers: corsHeaders });

    // 🎯 ডাইনামিক মেয়াদ (Expiry Date) ক্যালকুলেশন
    let expDateUnix = "1799345858";
    if (userData && userData.premiumExpiry) {
      expDateUnix = Math.floor(new Date(userData.premiumExpiry).getTime() / 1000).toString();
    }

    if (!STREAM_CACHE || !CATEGORY_CACHE || (now - CACHE_TIME) > CACHE_TTL) {
      const [streams, mergedM3uDoc] = await Promise.all([
        db.collection("posted_streams").find({}, { projection: { title: 1, group: 1, logo: 1, stream_url: 1 } }).toArray(),
        db.collection("system_settings").findOne({ key: "merged_premium_m3u" }, { projection: { content: 1 } })
      ]);

      const categoriesMap = new Map<string, string>();
      const processedStreams: any[] = [];
      let globalIdCounter = 1;

      streams.forEach((stream) => {
        const groupName = stream.group || "Live TV";
        const numericCatId = getNumericId(groupName).toString();
        categoriesMap.set(numericCatId, groupName);
        
        processedStreams.push({
          num: globalIdCounter++, name: stream.title || "Live TV", stream_type: "live", stream_id: getNumericId(stream._id.toString()), stream_icon: stream.logo || "", epg_channel_id: null, added: Math.floor(now / 1000).toString(), category_id: numericCatId, container_extension: "m3u8", custom_sid: "", tv_archive: 0, direct_source: "", tv_archive_duration: 0
        });
      });

      if (mergedM3uDoc && mergedM3uDoc.content) {
        const lines = mergedM3uDoc.content.split(/\r?\n/);
        let currentTitle = "Live TV"; let currentGroup = "VIP Channels"; let currentLogo = "";

        for (let line of lines) {
          line = line.trim();
          if (line.startsWith('#EXTINF')) {
            const groupMatch = line.match(/group-title="([^"]+)"/); const logoMatch = line.match(/tvg-logo="([^"]+)"/);
            currentGroup = groupMatch ? groupMatch[1] : "VIP Channels"; currentLogo = logoMatch ? logoMatch[1] : "";
            const titleParts = line.split(','); currentTitle = titleParts[titleParts.length - 1].trim();
          } else if (line.startsWith('http')) {
            const numericCatId = getNumericId(currentGroup).toString(); categoriesMap.set(numericCatId, currentGroup);
            processedStreams.push({
              num: globalIdCounter++, name: currentTitle, stream_type: "live", stream_id: getNumericId(line), stream_icon: currentLogo, epg_channel_id: null, added: Math.floor(now / 1000).toString(), category_id: numericCatId, container_extension: "m3u8", custom_sid: "", tv_archive: 0, direct_source: "", tv_archive_duration: 0
            });
          }
        }
      }

      if (processedStreams.length === 0) {
        categoriesMap.set("1", "Welcome");
        processedStreams.push({ num: 1, name: "No Channels Available", stream_type: "live", stream_id: 100, stream_icon: "", epg_channel_id: null, added: "0", category_id: "1", container_extension: "m3u8", custom_sid: "", tv_archive: 0, direct_source: "", tv_archive_duration: 0 });
      }

      const processedCategories = Array.from(categoriesMap.entries()).map(([catId, catName]) => ({ category_id: catId, category_name: catName, parent_id: 0 }));
      STREAM_CACHE = processedStreams; CATEGORY_CACHE = processedCategories; CACHE_TIME = now;
    }

    const host = req.headers.get('host') || 'localhost';
    const protocol = req.headers.get('x-forwarded-proto') || 'https';

    if (!action) {
      return NextResponse.json({
        user_info: {
          username: username, 
          password: password, 
          message: "Logged In", 
          auth: 1, 
          status: "Active", 
          exp_date: expDateUnix, // 🎯 ইউজারের আসল মেয়াদ সেট করা হলো
          is_trial: "0", 
          active_cons: "0", 
          created_at: Math.floor(now / 1000).toString(), 
          max_connections: "1", // 🎯 ম্যাক্স কানেকশন ১ করে দেওয়া হলো
          allowed_output_formats: ["m3u8", "ts", "rtmp"]
        },
        server_info: { url: host, port: "80", https_port: "443", server_protocol: protocol, rtmp_port: "8080", timezone: "Asia/Dhaka", timestamp_now: Math.floor(now / 1000), time_now: new Date().toISOString() }
      }, { headers: corsHeaders });
    }

    if (action === 'get_live_categories') return NextResponse.json(CATEGORY_CACHE, { headers: corsHeaders });
    if (action === 'get_live_streams') return NextResponse.json(STREAM_CACHE, { headers: corsHeaders });
    if (action === 'get_vod_categories' || action === 'get_series_categories' || action === 'get_vod_streams' || action === 'get_series') return NextResponse.json([], { headers: corsHeaders });

    return NextResponse.json({ message: "Action not supported" }, { status: 400, headers: corsHeaders });
  } catch (error) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500, headers: corsHeaders });
  }
}

export async function GET(req: Request) { return handleXtreamRequest(req); }
export async function POST(req: Request) { return handleXtreamRequest(req); }
