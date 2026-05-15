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

  // ডাটাবেস থেকে স্পেসিফিক স্ট্রিম ফেচ করা
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

  // HLS.js দিয়ে ভিডিও প্লেয়ার ইনিশিয়ালাইজ করা
  useEffect(() => {
    if (stream && stream.url && videoRef.current) {
      const video = videoRef.current;
      
      if (Hls.isSupported()) {
        const hls = new Hls({
          // CORS বা প্রক্সি ইস্যু বাইপাস করার জন্য কিছু বেসিক কনফিগারেশন
          enableWorker: true,
          lowLatencyMode: true,
        });
        
        hls.loadSource(stream.url);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          video.play().catch(() => console.log("অটো-প্লে ব্রাউজার দ্বারা ব্লক করা হয়েছে"));
        });

        return () => hls.destroy();
      } 
      // Safari ব্রাউজারের জন্য নেটিভ সাপোর্ট
      else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = stream.url;
        video.addEventListener('loadedmetadata', () => {
          video.play().catch(() => console.log("অটো-প্লে ব্রাউজার দ্বারা ব্লক করা হয়েছে"));
        });
      }
    }
  }, [stream]);

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        {/* ব্যাক বাটন */}
        <a href="/" className="inline-flex items-center text-slate-400 hover:text-red-500 transition-colors mb-6 text-sm font-medium">
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
            {/* ভিডিও প্লেয়ার */}
            <div className="w-full aspect-video bg-black rounded-2xl overflow-hidden border border-slate-800 shadow-2xl shadow-red-500/10 relative">
              <video
                ref={videoRef}
                controls
                className="w-full h-full"
                poster="https://placehold.co/1280x720/0f172a/ef4444?text=Loading+Stream...&font=montserrat"
              />
            </div>

            {/* চ্যানেল ইনফো */}
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
