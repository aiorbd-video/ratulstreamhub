// ফাইল পাথ: app/watch/[id]/page.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Artplayer from 'artplayer';
import Hls from 'hls.js';
import Link from 'next/link';

export default function WatchPage() {
  const params = useParams();
  const shortId = params.id as string;
  const playerRef = useRef<HTMLDivElement>(null);
  
  const [streamData, setStreamData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  
  // 🎯 আপনার টেলিগ্রাম বটের ইউজারনেম এখানে দিন
  const TELEGRAM_BOT_USERNAME = "YOUR_BOT_USERNAME_HERE"; 

  useEffect(() => {
    fetch(`/api/watch/${shortId}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) setStreamData(data);
        else setErrorMsg('এই স্ট্রিমটি আর সচল নেই বা মুছে ফেলা হয়েছে!');
        setLoading(false);
      })
      .catch(() => {
        setErrorMsg('সার্ভার থেকে ডাটা আনতে সমস্যা হয়েছে!');
        setLoading(false);
      });
  }, [shortId]);

  useEffect(() => {
    if (!streamData || !playerRef.current) return;

    let art: Artplayer;

    const customHlsConfig = {
      xhrSetup: function (xhr: any) {
        const { referer, origin, cookie, userAgent } = streamData.headers;
        if (userAgent) xhr.setRequestHeader('X-User-Agent', userAgent);
        if (cookie) xhr.setRequestHeader('X-Cookie', cookie);
        if (referer) xhr.setRequestHeader('X-Referer', referer);
        if (origin) xhr.setRequestHeader('X-Origin', origin);
      }
    };

    art = new Artplayer({
      container: playerRef.current,
      url: streamData.streamUrl,
      poster: streamData.logo,
      volume: 0.8,
      isLive: true, // লাইভ ইন্ডিকেটর অন থাকবে
      autoplay: true,
      muted: false,
      pip: true,
      autoSize: false,
      autoMini: true,
      screenshot: false,
      setting: true, // সেটিংস বাটন অন
      fullscreen: true, // পিসি ও টিভির জন্য নরমাল ফুলস্ক্রিন
      fullscreenWeb: true, // মোবাইলের জন্য ওয়েব ফুলস্ক্রিন
      lock: true, // মোবাইলে স্ক্রিন লক করার ফিচার
      hotkey: true, // ⌨️ পিসি কিবোর্ড এবং টিভি রিমোটের (Arrow Keys/Space) সাপোর্ট
      theme: '#ef4444',
      
      // 🎯 সিকবার এবং কন্ট্রোল বার সবসময় বা টাচ করলে সুন্দরভাবে দেখানোর কনফিগারেশন
      useControls: true,
      controlHideTime: 3000, // ৩ সেকেন্ড পর কন্ট্রোলবার লুকিয়ে যাবে

      // ⚙️ সেটিংস ফাংশন কাজ করার জন্য কাস্টম প্যানেল যুক্ত করা হলো (টিভি ও মোবাইলের জন্য বেস্ট)
      settings: [
        {
          html: 'Aspect Ratio (ভিডিও সাইজ)',
          width: 200,
          types: [
            { html: 'Default (স্বাভাবিক)', value: 'default' },
            { html: '16:9 (স্মার্ট টিভি সাইজ)', value: '16:9' },
            { html: '4:3 (পুরনো টিভি সাইច)', value: '4:3' },
            { html: 'Stretch (পুরো স্ক্রিন)', value: 'stretch' },
          ],
          onSelect: function (item: any) {
            art.aspectRatio = item.value;
            return item.html;
          },
        },
        {
          html: 'Playback Speed',
          width: 150,
          types: [
            { html: 'Normal', value: 1 },
            { html: '1.25x', value: 1.25 },
            { html: '1.5x', value: 1.5 },
            { html: '2.0x', value: 2 },
          ],
          onSelect: function (item: any) {
            art.playbackRate = item.value;
            return item.html;
          },
        }
      ],

      customType: {
        m3u8: function (video, url) {
          if (Hls.isSupported()) {
            const hls = new Hls(customHlsConfig);
            hls.loadSource(url);
            hls.attachMedia(video);
            
            hls.on(Hls.Events.ERROR, function (event, data) {
              if (data.fatal) {
                art.notice.show = "⚠️ Stream Failed! Redirecting to Telegram...";
                setTimeout(() => {
                  setErrorMsg('লাইভ স্ট্রিমটি প্লে হতে ব্যর্থ হয়েছে। নতুন লিংকের জন্য টেলিগ্রাম বটে যান!');
                  art.destroy(false);
                }, 2000);
              }
            });
          } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = url;
          } else {
            art.notice.show = 'Unsupported video format';
          }
        }
      },
    });

    // 🎯 লাইভ স্ট্রিমেও যেন সিকবার/টাইমলাইন সম্পূর্ণ সচল থাকে তার ট্রিকস
    art.on('ready', () => {
      const progress = art.template.$progress;
      if (progress) {
        progress.style.display = 'flex'; // সিকবার জোরপূর্বক দৃশ্যমান করা হলো
      }
    });

    return () => {
      if (art && art.destroy) {
        art.destroy(false);
      }
    };
  }, [streamData]);

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-2 md:p-6">
      
      {/* 📺 অল-ডিভাইস ফ্রেন্ডলি রেস্পন্সিভ কন্টেইনার (পিসি এবং টিভিতে থিয়েটার মোড বড় স্ক্রিন দেখাবে) */}
      <div className="w-full max-w-[1400px] bg-slate-900 border border-slate-800/80 rounded-2xl overflow-hidden shadow-2xl">
        
        <div className="p-4 border-b border-slate-800/60 flex justify-between items-center bg-slate-900/50 backdrop-blur-sm">
          <h1 className="text-sm md:text-lg font-bold flex items-center gap-2 line-clamp-1 max-w-[70%]">
            <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse flex-shrink-0"></span>
            {streamData ? streamData.title : 'Live Stream'}
          </h1>
          <Link href="/" className="text-xs md:text-sm bg-slate-800 hover:bg-red-600 px-3 py-1.5 rounded-xl transition-all font-medium border border-slate-700/50">
            ← ফিরে যান
          </Link>
        </div>

        {/* 🎬 ভিডিও প্লেয়ার এরিয়া: মোবাইলে ১৬:৯ এবং টিভি/পিসিতে বড় ভিউপোর্ট হাইট */}
        <div className="relative w-full aspect-video md:h-[70vh] md:aspect-auto bg-black flex items-center justify-center">
          
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 z-20">
              <div className="w-10 h-10 border-4 border-red-500 border-t-transparent rounded-full animate-spin mb-3"></div>
              <p className="text-xs text-slate-400">খেলার লিংক লোড হচ্ছে...</p>
            </div>
          )}

          {errorMsg && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/95 z-30 p-6 text-center backdrop-blur-sm">
              <div className="text-4xl mb-3">🤖</div>
              <h2 className="text-xl font-bold text-red-500 mb-1">স্ট্রিমিং ব্যর্থ হয়েছে!</h2>
              <p className="text-xs text-slate-400 mb-5 max-w-md">{errorMsg}</p>
              
              <a 
                href={`https://t.me/${TELEGRAM_BOT_USERNAME}?start={shortId}`} 
                target="_blank"
                rel="noopener noreferrer"
                className="bg-[#0088cc] hover:bg-[#0077b3] text-white text-sm font-bold py-3 px-6 rounded-xl transition-all shadow-lg shadow-blue-500/30 flex items-center gap-2 animate-bounce"
              >
                <span>বট থেকে নতুন লিংক নিন</span>
                <span>↗️</span>
              </a>
            </div>
          )}

          {/* Artplayer মূল এলিমেন্ট */}
          {!errorMsg && <div ref={playerRef} className="w-full h-full ArtPlayerContainer"></div>}
        </div>
      </div>
      
    </div>
  );
}
