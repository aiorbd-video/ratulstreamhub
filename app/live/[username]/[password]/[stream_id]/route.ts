// ফাইল পাথ: app/live/[username]/[password]/[streamId]/route.ts
import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

// 🚀 মেইন ইঞ্জিনের মতো একই নিউমেরিক হ্যাশ ফাংশন
function getNumericId(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) || 1;
}

export async function GET(
  req: Request,
  { params }: { params: { username: string; password: string; streamId: string } }
) {
  try {
    const { username, password, streamId } = params;
    
    // Televizo থেকে আসা স্ট্রিম আইডি (যেমন: 748392.m3u8) থেকে শুধু সংখ্যা বের করা
    const targetId = parseInt(streamId.split('.')[0]);

    if (isNaN(targetId)) return new Response("Invalid Stream ID", { status: 400 });

    const client = await clientPromise;
    const db = client.db("all_in_one_reborn_db");

    const user = await db.collection("web_users").findOne({ phone: username, password: password });
    if (!user || !user.isPremium || (user.premiumExpiry && new Date(user.premiumExpiry) < new Date())) {
      return new Response("Unauthorized Stream Access", { status: 403 });
    }

    let targetStreamUrl = "";

    // 🎯 ১. Posted Streams-এর ভেতর নিউমেরিক আইডি খোঁজ করা
    const streams = await db.collection("posted_streams").find({}, { projection: { stream_url: 1 } }).toArray();
    for (const stream of streams) {
      if (getNumericId(stream._id.toString()) === targetId) {
        targetStreamUrl = stream.stream_url;
        break;
      }
    }

    // 🎯 ২. যদি না পাওয়া যায়, তবে Merged M3U-এর ভেতর খোঁজ করা
    if (!targetStreamUrl) {
      const mergedM3uDoc = await db.collection("system_settings").findOne({ key: "merged_premium_m3u" }, { projection: { content: 1 } });
      if (mergedM3uDoc && mergedM3uDoc.content) {
        const lines = mergedM3uDoc.content.split(/\r?\n/);
        for (let line of lines) {
          line = line.trim();
          if (line.startsWith('http')) {
            if (getNumericId(line) === targetId) {
              targetStreamUrl = line;
              break;
            }
          }
        }
      }
    }

    if (!targetStreamUrl) return new Response("Stream Not Found", { status: 404 });

    let tempHeaders: Record<string, string> = {};
    let finalCleanUrl = targetStreamUrl;

    if (targetStreamUrl.includes('|')) {
      const parts = targetStreamUrl.split('|');
      finalCleanUrl = parts[0].trim();
      const headerPairs = parts[1].split('&');
      for (const pair of headerPairs) {
        const eqIdx = pair.indexOf('=');
        if (eqIdx > 0) {
          tempHeaders[pair.substring(0, eqIdx).trim().toLowerCase()] = pair.substring(eqIdx + 1).trim();
        }
      }
    }

    const redirectHeaders = new Headers();
    redirectHeaders.set("Location", finalCleanUrl);
    redirectHeaders.set("Access-Control-Allow-Origin", "*");

    if (tempHeaders['user-agent']) redirectHeaders.set("X-Forwarded-User-Agent", tempHeaders['user-agent']);
    if (tempHeaders['cookie']) redirectHeaders.set("Set-Cookie", tempHeaders['cookie']);

    return new Response(null, {
      status: 302,
      headers: redirectHeaders
    });

  } catch (error) {
    return new Response("Server Error", { status: 500 });
  }
}
