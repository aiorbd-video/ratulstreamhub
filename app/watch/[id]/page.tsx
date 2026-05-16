// ফাইল পাথ: app/watch/[id]/page.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Hls from 'hls.js';
import Artplayer from 'artplayer';

export default function WatchPage() {
  const params = useParams();
  const artRef = useRef<HTMLDivElement>(null);
  const [stream, setStream] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [streamFailed, setStreamFailed] = useState(false);

  // আপনার টেলিগ্রাম বটের ইউজারনেম
  const BOT_USERNAME = "ratulnotific_bot"; 

  useEffect(() => {
    if (!params.id) return;
    
    async function fetchStream() {
      try {
        const res = await fetch(`/api/stream/${params.id}`);
        const data = await res.json();
        if (data.success) {
          setStream(data.stream);
        }
      } catch (error) {
        console.error("Error fetching stream:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchStream();
  }, [params.id]);

  useEffect(() => {
    if (!stream || !stream.stream_url || !artRef.current || streamFailed) return;

    let art: Artplayer;

    const initArtPlayer = () => {
      art = new Artplayer({
        container: artRef.current!,
        url: stream.stream_url,
        // 🎯 title লাইনটি মুছে দেওয়া হয়েছে কারণ টাইপস্ক্রিপ্ট এটি সাপোর্ট করে না
        poster: 'https://placehold.co/1280x720/000000/000000',
        volume: 0.8,
        isLive: true,
        muted: false,
        autoplay: true,
        pip: true,
        autoSize: true,
        autoMini: true,
        setting: true,
        fullscreen: true,
        theme: '#ef4444',
        customType: {
          m3u8: function (video, url, artInstance) {
            if (Hls.isSupported()) {
              const hls = new Hls({
                enableWorker: true,
                lowLatencyMode: true,
                xhrSetup: function (xhr, url) {
                  if (stream.referer) {
                    xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
                  }
                  if (stream.user_agent) {
                    xhr.setRequestHeader('X-Custom-User-Agent', stream.user_agent);
                  }
                  if (stream.origin) {
                    xhr.setRequestHeader('X-Custom-Origin', stream.origin);
                  }
                }
              });

              hls.loadSource(url);
              hls.attachMedia(video);

              hls.on(Hls.Events.ERROR, (event, data) => {
                if (data.fatal) {
                  if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
                    console.log("Fatal Network Error, triggering fallback...");
                    setStreamFailed(true);
                    artInstance.destroy();
                  } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
                    hls.recoverMediaError();
                  } else {
                    setStreamFailed(true);
                    artInstance.destroy();
                  }
                }
              });

              artInstance.on('destroy', () => hls.destroy());
            } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
              video.src = url;
            } else {
              artInstance.notice.show = 'Unsupported video format';
            }
          }
        }
      });
    };

    initArtPlayer();

    return () => {
      if (art && art.destroy) {
        art.destroy(false);
      }
    };
  }, [stream, streamFailed]);

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <a href="/" className="inline-flex items-center text-slate-400 hover:text-red-500 transition-colors mb-6 text-sm font-medium bg-slate-900 px-4 py-2 rounded-lg border border-slate-800">
          <span>← হোম পেজে ফিরে যান</span>
        </a>

        {loading ? (
          <div className="aspect-video bg-slate-900 rounded-2xl flex items-center justify-center border border-slate-800">
            <div className="w-12 h-12 border-4 border-red-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : !stream ? (
          <div className="aspect-video bg-slate-900 rounded-2xl flex flex-col items-center justify-center border border-slate-800">
            <span className="text-4xl mb-4">⚠️</span>
            <p className="text-xl font-medium text-slate-300">চ্যানেলটি খুঁজে পাওয়া যায়নি!</p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            
            {!streamFailed ? (
              <div 
                ref={artRef} 
                className="w-full aspect-video bg-black rounded-2xl overflow-hidden border border-slate-800 shadow-2xl relative"
              />
            ) : (
              <div className="w-full aspect-video bg-slate-900 rounded-2xl border border-red-500/30 flex flex-col items-center justify-center p-6 text-center shadow-2xl shadow-red-500/10">
                <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mb-4">
                  <span className="text-4xl">🤖</span>
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">স্ট্রিমটি ব্রাউজারে চালানো যাচ্ছে না</h2>
                <p className="text-slate-400 mb-6 max-w-md">
                  সার্ভার সিকিউরিটির কারণে এই ভিডিওটি সরাসরি ওয়েবসাইটে ব্লক করা হয়েছে। দয়া করে আমাদের টেলিগ্রাম বট থেকে সরাসরি লিংকটি সংগ্রহ করুন।
                </p>
                <a 
  href={`https://t.me/${BOT_USERNAME}?start=${params.id}`} 
  target="_blank" 

                  rel="noopener noreferrer"
                  className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold py-3 px-8 rounded-xl transition-all duration-300 flex items-center gap-2 shadow-lg shadow-blue-500/25"
                >
                  <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.888-.667 3.473-1.512 5.79-2.51 6.95-2.992 3.308-1.373 3.996-1.613 4.444-1.623z"/></svg>
                  বট ওপেন করুন
                </a>
              </div>
            )}

            <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800">
              <span className="bg-red-600/20 text-red-500 border border-red-500/20 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-3 inline-block">
                {stream.group || 'Live Sports'}
              </span>
              <h1 className="text-2xl md:text-3xl font-bold text-slate-100">
                {stream.title}
              </h1>
              
              <div className="mt-4 p-4 bg-black/50 rounded-xl border border-slate-800/50">
                <p className="text-xs text-slate-400 font-mono break-all">
                  <span className="text-red-500 font-bold mr-2">🔗 Stream Link:</span>
                  {stream.stream_url ? stream.stream_url : "লিংক পাওয়া যায়নি!"}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
