// ফাইল পাথ: app/live/[username]/[password]/[streamId]/route.ts
import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';

export const dynamic = 'force-dynamic';

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
    
    const targetId = parseInt(streamId.split('.')[0]);
    if (isNaN(targetId)) return new Response("Invalid Stream ID", { status: 400 });

    const client = await clientPromise;
    const db = client.db("all_in_one_reborn_db");

    const user = await db.collection("web_users").findOne({ phone: username, password: password });
    if (!user || !user.isPremium || (user.premiumExpiry && new Date(user.premiumExpiry) < new Date())) {
      return new Response("Unauthorized Stream Access", { status: 403 });
    }

    let targetStreamUrl = "";

    const streams = await db.collection("posted_streams").find({}, { projection: { stream_url: 1 } }).toArray();
    for (const stream of streams) {
      if (getNumericId(stream._id.toString()) === targetId) {
        targetStreamUrl = stream.stream_url;
        break;
      }
    }

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

    // 🚀 THE MAGIC: 302 রিডাইরেক্ট বাদ দিয়ে Mini-M3U8 জেনারেট করা হচ্ছে
    // এর ফলে Televizo/Smarters কুকি এবং হেডারগুলো ঠিকমতো সার্ভারে পাঠাতে বাধ্য হবে!
    let m3uContent = "#EXTM3U\n";
    if (tempHeaders['user-agent']) m3uContent += `#EXTVLCOPT:http-user-agent=${tempHeaders['user-agent']}\n`;
    if (tempHeaders['cookie']) m3uContent += `#EXTVLCOPT:http-cookie=${tempHeaders['cookie']}\n`;
    if (tempHeaders['referer'] || tempHeaders['referrer']) {
      m3uContent += `#EXTVLCOPT:http-referrer=${tempHeaders['referer'] || tempHeaders['referrer']}\n`;
    }
    if (tempHeaders['origin']) m3uContent += `#EXTVLCOPT:http-origin=${tempHeaders['origin']}\n`;
    
    m3uContent += `${finalCleanUrl}\n`;

    return new Response(m3uContent, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.apple.mpegurl",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-cache"
      }
    });

  } catch (error) {
    return new Response("Server Error", { status: 500 });
  }
}
