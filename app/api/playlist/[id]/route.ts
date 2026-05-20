// ফাইল পাথ: app/api/playlist/[id]/route.ts
import clientPromise from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export const dynamic = 'force-dynamic';

const securityHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "*",
  "Cache-Control": "no-store, no-cache, must-revalidate",
  "Pragma": "no-cache",
  "Expires": "0"
};

export async function OPTIONS() {
  return new Response(null, { status: 200, headers: securityHeaders });
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const userAgent = req.headers.get('user-agent')?.toLowerCase() || '';

    // 🚫 সিকিউরিটি: ব্রাউজার থেকে লিকেজ বন্ধ
    const isBrowser = userAgent.includes('mozilla') && 
                      (userAgent.includes('chrome') || userAgent.includes('safari') || userAgent.includes('firefox') || userAgent.includes('edge')) && 
                      !userAgent.includes('tv') && 
                      !userAgent.includes('smarters') && 
                      !userAgent.includes('iptv');

    if (isBrowser) {
      return new Response("🚫 Access Denied! Please open this M3U playlist inside Televizo app.", { 
        status: 403, 
        headers: { "Content-Type": "text/plain", ...securityHeaders } 
      });
    }

    const client = await clientPromise;
    const db = client.db("all_in_one_reborn_db");

    let userId;
    try { userId = new ObjectId(params.id); } catch (e) {
      return new Response("#EXTM3U\n#EXTINF:-1, ❌ Invalid User ID\nhttp://error.local", { status: 400, headers: securityHeaders });
    }

    const user = await db.collection("web_users").findOne(
      { _id: userId }, 
      { projection: { isPremium: 1, premiumExpiry: 1, phone: 1 } }
    );

    // 🎯 অ্যাকাউন্ট মেয়াদ চেক
    if (!user || !user.isPremium || (user.premiumExpiry && new Date(user.premiumExpiry) < new Date())) {
      return new Response("#EXTM3U\n#EXTINF:-1, 🚫 Subscription Expired!\nhttp://expired.local", {
        status: 403,
        headers: { "Content-Type": "application/vnd.apple.mpegurl", ...securityHeaders }
      });
    }

    const [streams, mergedM3uDoc] = await Promise.all([
      db.collection("posted_streams").find({}, { projection: { title: 1, group: 1, logo: 1, stream_url: 1 } }).toArray(),
      db.collection("system_settings").findOne({ key: "merged_premium_m3u" }, { projection: { content: 1 } })
    ]);

    let rawM3uText = "";

    for (const stream of streams) {
      if (!stream.stream_url) continue;
      let rawTitle = (stream.title || "").replace(/tvg-[a-zA-Z0-9\-]+="[^"]*"/g, "").replace(/(https?:\/\/[^\s]+)/g, "").replace(/^[,-\s]+/, "").trim() || "Live TV";
      rawM3uText += `#EXTINF:-1 tvg-logo="${stream.logo || ''}" group-title="${stream.group || 'Live TV'}", ${rawTitle}\n`;
      rawM3uText += `${stream.stream_url.trim()}\n`;
    }

    if (mergedM3uDoc && mergedM3uDoc.content) {
      rawM3uText += `${mergedM3uDoc.content}\n`;
    }

    // 🚀 THE ULTIMATE SANITIZER (যেকোনো জঞ্জাল লিংক ফিক্স করার ম্যাজিক)
    let sanitizedText = rawM3uText
      // ১. ট্যাগগুলোর আগে জোর করে নিউলাইন বসানো
      .replace(/(#EXTINF)/gi, "\n$1")
      .replace(/(#EXTVLCOPT)/gi, "\n$1")
      .replace(/(#EXTHTTP)/gi, "\n$1")
      // ২. যদি হ্যাশ (#) ছাড়া EXTVLCOPT থাকে, তবে সেটা ফিক্স করা
      .replace(/(^|[^\w#])(EXTVLCOPT|EXTHTTP)/gi, "$1\n#$2")
      // ৩. সবচেয়ে বড় ফিক্স: Referer লিংকের সাথে মেইন লিংক জোড়া লেগে থাকলে (যেমন: com/https://) সেটাকে দুই লাইনে ভেঙে দেওয়া
      .replace(/([^"'\s=])(https?:\/\/)/gi, "$1\n$2")
      // ৪. অতিরিক্ত ফাঁকা লাইন রিমুভ করা
      .replace(/\n+/g, "\n");


    let m3uContent = "#EXTM3U x-tvg-url=\"\"\n";

    // ⭐ VIP Account Expiry Header
    const expText = user.premiumExpiry 
      ? new Date(user.premiumExpiry).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) 
      : "Unlimited (Lifetime)";
    m3uContent += `#EXTINF:-1 tvg-logo="https://cdn-icons-png.flaticon.com/512/2740/2740600.png" group-title="⭐ Account Info", 👤 VIP Status | Expiry: ${expText}\n`;
    m3uContent += `http://local.info/account\n`;

    // 🚀 THE ULTIMATE PARSER ENGINE (All Headers Supported)
    const lines = sanitizedText.split(/\r?\n/);
    
    let tempHeaders: Record<string, string> = {};
    let currentExtInf = "";

    for (let line of lines) {
      line = line.trim();
      if (!line || line.startsWith('#EXTM3U')) continue;

      if (line.startsWith('#EXTINF')) {
        if (currentExtInf) m3uContent += `${currentExtInf}\n`;
        currentExtInf = line;
      } 
      else if (line.toUpperCase().startsWith('#EXTVLCOPT')) {
        // 🎯 EXTVLCOPT এর ভেতর থেকে কুকি, রেফারের, অরিজিন বের করে আনা
        const splitIdx = line.indexOf('=');
        if (splitIdx > -1) {
          const keyPart = line.substring(0, splitIdx).toLowerCase();
          const valPart = line.substring(splitIdx + 1).trim();
          
          if (keyPart.includes('user-agent')) tempHeaders['User-Agent'] = valPart;
          else if (keyPart.includes('referer') || keyPart.includes('referrer')) tempHeaders['Referer'] = valPart;
          else if (keyPart.includes('cookie')) tempHeaders['Cookie'] = valPart;
          else if (keyPart.includes('origin')) tempHeaders['Origin'] = valPart;
        }
      } 
      else if (line.toUpperCase().startsWith('#EXTHTTP')) {
        // 🎯 JSON ফরম্যাটে কুকি বা হেডার থাকলে তা পার্স করা
        try {
          const jsonStr = line.substring(line.indexOf(':') + 1).trim();
          const parsed = JSON.parse(jsonStr);
          for (const key in parsed) {
            const lk = key.toLowerCase();
            if (lk === 'cookie') tempHeaders['Cookie'] = parsed[key];
            else if (lk === 'referer' || lk === 'referrer') tempHeaders['Referer'] = parsed[key];
            else if (lk === 'origin') tempHeaders['Origin'] = parsed[key];
            else if (lk === 'user-agent') tempHeaders['User-Agent'] = parsed[key];
          }
        } catch(e) {}
      } 
      else if (line.startsWith('http')) {
        let fullUrl = line;

        // 🎯 পাইপ (|) ফরম্যাটে হেডার থাকলে তা ভেঙে বের করা
        if (fullUrl.includes('|')) {
          const parts = fullUrl.split('|');
          fullUrl = parts[0].trim();
          if (parts[1]) {
            const headerPairs = parts[1].split('&');
            for (const pair of headerPairs) {
              const equalIndex = pair.indexOf('=');
              if (equalIndex > 0) {
                const key = pair.substring(0, equalIndex).trim().toLowerCase();
                const val = pair.substring(equalIndex + 1).trim();
                if (key === 'cookie') tempHeaders['Cookie'] = val;
                else if (key === 'user-agent') tempHeaders['User-Agent'] = val;
                else if (key === 'referer' || key === 'referrer') tempHeaders['Referer'] = val;
                else if (key === 'origin') tempHeaders['Origin'] = val;
              }
            }
          }
        }

        // #EXTINF লাইনে রাইট করা
        if (currentExtInf) {
          m3uContent += `${currentExtInf}\n`;
          currentExtInf = ""; 
        }

        // 🚀 THE FINAL ASSEMBLY (সব হেডারকে নিখুঁত Televizo ফরম্যাটে সাজানো)
        if (tempHeaders['User-Agent']) m3uContent += `#EXTVLCOPT:http-user-agent=${tempHeaders['User-Agent']}\n`;
        if (tempHeaders['Referer']) m3uContent += `#EXTVLCOPT:http-referrer=${tempHeaders['Referer']}\n`;
        if (tempHeaders['Origin']) m3uContent += `#EXTVLCOPT:http-origin=${tempHeaders['Origin']}\n`;
        if (tempHeaders['Cookie']) m3uContent += `#EXTVLCOPT:http-cookie=${tempHeaders['Cookie']}\n`;
        
        // একদম ফ্রেশ ভিডিও লিংক (কোনো জঞ্জাল ছাড়া)
        m3uContent += `${fullUrl}\n`;
        
        // পরের লিংকের জন্য বাকেট খালি করা
        tempHeaders = {}; 
      } 
      else {
        // অজানা কোনো ট্যাগ থাকলে
        if (currentExtInf) {
          m3uContent += `${currentExtInf}\n`;
          currentExtInf = "";
        }
        m3uContent += `${line}\n`;
      }
    }

    if (currentExtInf) m3uContent += `${currentExtInf}\n`;

    return new Response(m3uContent, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.apple.mpegurl",
        "Content-Disposition": `inline; filename="All_In_One_Televizo_${user.phone || 'VIP'}.m3u"`,
        ...securityHeaders
      }
    });

  } catch (error) {
    return new Response("#EXTM3U\n#EXTINF:-1, ❌ Server Error\nhttp://error.local", { status: 500, headers: securityHeaders });
  }
}
