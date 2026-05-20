// ফাইল পাথ: app/live/[username]/[password]/[streamId]/route.ts
import { NextResponse } from 'next/server';
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export const dynamic = 'force-dynamic';

export async function GET(
  req: Request,
  { params }: { params: { username: string; password: string; streamId: string } }
) {
  try {
    const { username, password, streamId } = params;
    
    // এক্সটেনশন ছেঁটে ফেলা (.m3u8 বা .ts থাকলে)
    const cleanStreamId = streamId.split('.')[0];

    const client = await clientPromise;
    const db = client.db("all_in_one_reborn_db");

    // ১. ভিডিও প্লে করার সময়ও দ্রুত ইউজার ভ্যালিডেশন
    const user = await db.collection("web_users").findOne({ phone: username, password: password });
    if (!user || !user.isPremium || (user.premiumExpiry && new Date(user.premiumExpiry) < new Date())) {
      return new Response("Unauthorized Stream Access", { status: 403 });
    }

    let targetStreamUrl = "";

    // ২. আইডি যদি মঙ্গোডিবি ওল্ড আইডি হয় (Posted Streams)
    if (ObjectId.isValid(cleanStreamId)) {
      const stream = await db.collection("posted_streams").findOne({ _id: new ObjectId(cleanStreamId) });
      if (stream && stream.stream_url) {
        targetStreamUrl = stream.stream_url.trim();
      }
    } else {
      // ৩. আইডি যদি মার্জড ফাইলের বেস-৬৪ লিংক হয়, তবে ডাটাবেস ছাড়াই ক্যাশ বা মার্জড ফাইল থেকে ম্যাচ করবে
      const mergedM3uDoc = await db.collection("system_settings").findOne({ key: "merged_premium_m3u" }, { projection: { content: 1 } });
      if (mergedM3uDoc && mergedM3uDoc.content) {
        const lines = mergedM3uDoc.content.split(/\r?\n/);
        for (let line of lines) {
          line = line.trim();
          if (line.startsWith('http')) {
            const generatedId = Buffer.from(line).toString('base64').substring(0, 12);
            if (generatedId === cleanStreamId) {
              targetStreamUrl = line;
              break;
            }
          }
        }
      }
    }

    if (!targetStreamUrl) {
      return new Response("Stream Not Found", { status: 404 });
    }

    // 🚀 ৪. Televizo/VLC স্পেশাল হেডার রিরাইট ও ইনজেকশন
    let tempHeaders: Record<string, string> = {};
    let finalCleanUrl = targetStreamUrl;

    // যদি ফাইলে আগে থেকেই পাইপ থাকে, সেগুলোকে খুলে হেডার বাকেটে নেওয়া হচ্ছে
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

    // টেলিভিশো বা প্লেয়ার ইঞ্জিনের কাছে সঠিক নেটিভ ফরমেটে হেডার পাস করা হচ্ছে
    const redirectHeaders = new Headers();
    redirectHeaders.set("Location", finalCleanUrl);
    redirectHeaders.set("Access-Control-Allow-Origin", "*");

    // অরিজিনাল হেডারগুলো রিডাইরেক্ট লোকেশনের সাথে বাইন্ড করা হচ্ছে
    if (tempHeaders['user-agent']) redirectHeaders.set("X-Forwarded-User-Agent", tempHeaders['user-agent']);
    if (tempHeaders['cookie']) redirectHeaders.set("Set-Cookie", tempHeaders['cookie']);

    // আসল লিংক সম্পূর্ণ হাইড রেখে প্লেয়ারকে সরাসরি ডাইরেক্ট সোর্সে পাঠিয়ে দেওয়া হলো
    return new Response(null, {
      status: 302,
      headers: redirectHeaders
    });

  } catch (error) {
    return new Response("Server Error", { status: 500 });
  }
}
