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
    if (stream && stream.url && videoRef.current) {
      const video = videoRef.current;
      
      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
        });
        
        hls.loadSource(stream.url);
        hls.attachMedia(video);
        
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          // প্লে শুরু হলে এরর মেসেজ রিমুভ করে দেবে
          setErrorMsg(null);
          video.play().catch(() => {
            console.log("অটো-প্লে ব্রাউজার দ্বারা ব্লক করা হয়েছে। দয়া করে প্লে বাটনে ক্লিক করুন।");
          });
        });

        // 🎯 স্মার্ট এরর ক্যাচার
        hls.on(Hls.Events.ERROR, (event, data) => {
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                setErrorMsg("🔴 CORS বা নেটওয়ার্ক এরর! ব্রাউজার এই লিংকটি সরাসরি ব্লক করছে। একটি প্রক্সি প্রয়োজন।");
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                setErrorMsg("🔴 মিডিয়া এরর! ভিডিও ডিকোড করতে সমস্যা হচ্ছে।");
                hls.recoverMediaError();
                break;
              default:
                setErrorMsg("🔴 স্ট্রিমিং সার্ভার সংযোগ বিচ্ছিন্ন করেছে।");
                hls.destroy();
                break;
            }
          }
        });

        return () => hls.destroy();
      } 
      else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = stream.url;
        video.addEventListener('loadedmetadata', () => {
          video.play().catch(() => console.log("Play blocked"));
        });
        video.addEventListener('error', () => {
          setErrorMsg("🔴 ব্রাউজার এই ফরম্যাট বা লিংকটি সাপোর্ট করছে না (CORS Error)।");
        });
      }
    }
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
            <div className="w-full aspect-video bg-black rounded-2xl overflow-hidden border border-slate-800 shadow-2xl relative">
              
              {/* 🎯 যদি এরর খায়, স্ক্রিনের উপরে ভেসে উঠবে */}
              {errorMsg && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/80 backdrop-blur-sm p-6 text-center">
                  <div className="bg-red-950/80 border border-red-500/50 p-6 rounded-xl">
                    <p className="text-red-400 font-semibold">{errorMsg}</p>
                    <p className="text-xs text-slate-400 mt-3 break-all bg-black/50 p-2 rounded">
                      লিংক: {stream.url}
                    </p>
                  </div>
                </div>
              )}

              <video
                ref={videoRef}
                controls
                className="w-full h-full"
                // Loading poster পরিবর্তন করে সাধারণ কালো রাখা হলো
                poster="https://placehold.co/1280x720/000000/000000"
              />
            </div>

            <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800">
              <span className="bg-red-600/20 text-red-500 border border-red-500/20 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider mb-3 inline-block">
                {stream.group || 'Live Sports'}
              </span>
              <h1 className="text-2xl md:text-3xl font-bold text-slate-100">
                {stream.title}
              </h1>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
