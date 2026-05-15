// ফাইল পাথ: app/watch/[id]/page.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Hls from 'hls.js';

export default function WatchPage() {
  const params = useParams();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!params.id) return;
    
    async function fetchStream() {
      try {
        const res = await fetch(`/api/stream/${params.id}`);
        const data = await res.json();
        if (data.success) {
          setStream(data.stream);
          console.log("✅ ডাটাবেস থেকে পাওয়া লিংক:", data.stream.stream_url);
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
    // 🎯 এখানে url এর বদলে stream_url করে দেওয়া হয়েছে
    if (!stream || !stream.stream_url || !videoRef.current) return;

    let hls: Hls;
    const video = videoRef.current;
    
    // 🎯 এখানেও stream_url
    let currentUrl = stream.stream_url.replace('http://', 'https://');
    let isUsingProxy = false;

    const initPlayer = (playUrl: string) => {
      if (Hls.isSupported()) {
        if (hls) hls.destroy();

        hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
        });
        
        hls.loadSource(playUrl);
        hls.attachMedia(video);
        
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setErrorMsg(null);
          video.play().catch(() => console.log("Play button click required."));
        });

        hls.on(Hls.Events.ERROR, (event, data) => {
          if (data.fatal) {
            if (data.type === Hls.ErrorTypes.NETWORK_ERROR && !isUsingProxy) {
              console.log("CORS Error detected. Retrying with Proxy...");
              isUsingProxy = true;
              // 🎯 এখানেও stream_url
              const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(stream.stream_url)}`;
              initPlayer(proxyUrl);
            } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
              hls.recoverMediaError();
            } else {
              setErrorMsg("🔴 সার্ভার ডাউন বা লিংকটি ব্লক করা হয়েছে।");
              hls.destroy();
            }
          }
        });
      } 
      else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = playUrl;
        video.addEventListener('loadedmetadata', () => {
          video.play().catch(() => console.log("Play blocked"));
        });
      }
    };

    initPlayer(currentUrl);

    return () => {
      if (hls) hls.destroy();
    };
  }, [stream]);

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
            <div className="w-full aspect-video bg-black rounded-2xl overflow-hidden border border-slate-800 shadow-2xl relative flex items-center justify-center">
              
              {errorMsg && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/80 backdrop-blur-sm p-6 text-center">
                  <div className="bg-red-950/80 border border-red-500/50 p-6 rounded-xl max-w-md">
                    <p className="text-red-400 font-semibold">{errorMsg}</p>
                  </div>
                </div>
              )}

              <video
                ref={videoRef}
                controls
                autoPlay
                className="w-full h-full"
              />
            </div>

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
                  {/* 🎯 এখানেও stream_url করে দেওয়া হয়েছে */}
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
