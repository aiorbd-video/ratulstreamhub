// ফাইল পাথ: app/page.tsx
'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';

interface Stream {
  _id: string;
  title: string;
  group: string;
  logo?: string;
  short_id: string;
}

export default function Home() {
  const [streams, setStreams] = useState<Stream[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    async function fetchStreams() {
      try {
        const res = await fetch('/api/streams');
        const data = await res.json();
        
        if (data.success) {
          // 🎯 ম্যাজিক ক্লিনার: ডেটাবেসের ময়লা ডেটা ফিল্টার করার লজিক
          const cleanedStreams = data.streams.map((stream: any) => {
            let rawTitle = stream.title || "";
            let finalLogo = stream.logo || "";

            // ১. টাইটেলের ভেতর tvg-logo থাকলে সেটা বের করে লোগোতে বসানো
            const logoMatch = rawTitle.match(/tvg-logo="([^"]+)"/);
            if (logoMatch) {
              finalLogo = logoMatch[1];
            } else {
              // যদি কোটেশন ছাড়া কোনো লিংক টাইটেলে থাকে
              const urlMatch = rawTitle.match(/(https?:\/\/[^\s,]+)/);
              if (urlMatch && !finalLogo) finalLogo = urlMatch[1];
            }

            // ২. টাইটেল থেকে tvg- এর হাবিজাবি ট্যাগগুলো মুছে ফেলা
            rawTitle = rawTitle.replace(/tvg-[a-zA-Z0-9\-]+="[^"]*"/g, "");
            
            // ৩. লিংকের অংশ বা w_300,q_85 জাতীয় লেখা মুছে ফেলা
            rawTitle = rawTitle.replace(/(https?:\/\/[^\s]+)/g, "");
            rawTitle = rawTitle.replace(/w_[0-9]+,q_[0-9]+\/[^\s]+/g, "");

            // ৪. অতিরিক্ত কমা, স্পেস বা ড্যাশ পরিষ্কার করে ফ্রেশ টাইটেল বানানো
            let cleanTitle = rawTitle.replace(/^[,-\s]+/, "").trim();

            return {
              ...stream,
              title: cleanTitle || "Live Stream", // যদি সব মুছে গিয়ে ফাঁকা হয়ে যায়
              logo: finalLogo
            };
          });

          setStreams(cleanedStreams);
        }
      } catch (error) {
        console.error('Failed to fetch streams:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchStreams();
  }, []);

  const filteredStreams = streams.filter((stream) =>
    stream.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    stream.group.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans">
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <h1 className="text-2xl font-black bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent uppercase tracking-wider">
            Ratul Stream Hub
          </h1>
          <div className="w-full sm:w-72">
            <input
              type="text"
              placeholder="🔍 চ্যানেল বা খেলা খুঁজুন..."
              className="w-full px-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-400 focus:outline-none focus:border-red-500 transition-all text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-12 h-12 border-4 border-red-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-slate-400 animate-pulse">লাইভ স্ট্রিমগুলো লোড হচ্ছে...</p>
          </div>
        ) : filteredStreams.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-xl text-slate-400 font-medium">🔴 এই মুহূর্তে কোনো লাইভ স্ট্রিম সচল নেই।</p>
            <p className="text-sm text-slate-500 mt-2">পরবর্তী খেলার আপডেটের জন্য অপেক্ষা করুন।</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {filteredStreams.map((stream) => (
              <div
                key={stream._id}
                className="group bg-slate-900 border border-slate-800/80 rounded-2xl overflow-hidden hover:border-red-500/50 hover:shadow-lg hover:shadow-red-500/5 transition-all duration-300 flex flex-col"
              >
                <div className="aspect-video w-full bg-slate-950 relative overflow-hidden flex items-center justify-center border-b border-slate-800">
                  {stream.logo && stream.logo.startsWith('http') ? (
                    <Image
                      src={stream.logo}
                      alt={stream.title}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-500"
                      sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
                      unoptimized={true}
                    />
                  ) : (
                    <span className="text-4xl">📺</span>
                  )}
                  <span className="absolute top-2 left-2 bg-red-600 text-[10px] font-black uppercase px-2 py-0.5 rounded-md tracking-wider animate-pulse shadow z-10">
                    LIVE
                  </span>
                </div>

                <div className="p-4 flex flex-col flex-grow justify-between gap-3">
                  <div>
                    <span className="text-[11px] font-bold text-red-400 uppercase tracking-wide block mb-1 line-clamp-1">
                      {stream.group || 'Live Sports'}
                    </span>
                    <h3 className="font-semibold text-sm line-clamp-2 text-slate-200 group-hover:text-white transition-colors">
                      {stream.title}
                    </h3>
                  </div>
                  
                  <a
                    href={`/watch/${stream.short_id}`}
                    className="w-full text-center bg-slate-850 hover:bg-gradient-to-r hover:from-red-600 hover:to-orange-600 text-white text-xs font-bold py-2.5 px-4 rounded-xl transition-all duration-300 border border-slate-700 group-hover:border-transparent"
                  >
                    📺 সরাসরি দেখুন
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
