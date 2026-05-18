// ফাইল পাথ: app/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import AdBanner from './components/AdBanner';
import NativeBanner from './components/NativeBanner';

interface Stream {
  _id: string;
  title: string;
  group: string;
  logo?: string;
  short_id: string;
}

export default function Home() {
  const { data: session } = useSession();
  const isPremium = (session?.user as any)?.isPremium === true;

  const [streams, setStreams] = useState<Stream[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // 🎯 M3U পপআপ এবং হোস্ট ইউআরএল স্টেট
  const [showM3uModal, setShowM3uModal] = useState(false);
  const [baseUrl, setBaseUrl] = useState('');

  useEffect(() => {
    setBaseUrl(window.location.origin);

    async function fetchStreams() {
      try {
        const res = await fetch('/api/streams');
        const data = await res.json();
        
        if (data.success) {
          const cleanedStreams = data.streams.map((stream: any) => {
            let rawTitle = stream.title || "";
            let finalLogo = stream.logo || "";

            if (!finalLogo) {
              const logoMatch = rawTitle.match(/tvg-logo="([^"]+)"/);
              if (logoMatch) finalLogo = logoMatch[1];
              else {
                const urlMatch = rawTitle.match(/(https?:\/\/[^\s,]+)/);
                if (urlMatch) finalLogo = urlMatch[1];
              }
            }

            rawTitle = rawTitle.replace(/tvg-[a-zA-Z0-9\-]+="[^"]*"/g, "");
            rawTitle = rawTitle.replace(/(https?:\/\/[^\s]+)/g, "");
            rawTitle = rawTitle.replace(/w_[0-9]+,q_[0-9]+\/[^\s]+/g, "");

            let cleanTitle = rawTitle.replace(/^[,-\s]+/, "").trim();

            return {
              ...stream,
              title: cleanTitle || "Live Stream",
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
    <div className="min-h-screen bg-slate-950 text-white font-sans relative overflow-hidden">
      
      {/* 🌟 Aurora Motion Background */}
      <div className="fixed inset-0 w-full h-full pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40vw] h-[40vw] rounded-full bg-red-600/20 blur-[120px] animate-blob mix-blend-screen"></div>
        <div className="absolute top-[20%] right-[-10%] w-[35vw] h-[35vw] rounded-full bg-orange-600/20 blur-[120px] animate-blob animation-delay-2000 mix-blend-screen"></div>
        <div className="absolute bottom-[-10%] left-[20%] w-[45vw] h-[45vw] rounded-full bg-purple-600/20 blur-[120px] animate-blob animation-delay-4000 mix-blend-screen"></div>
      </div>

      <div className="relative z-10">
        <header className="border-b border-slate-800/50 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50">
          <div className="max-w-[1600px] mx-auto px-4 py-4 flex flex-col md:flex-row items-center justify-between gap-4">
            
            <h1 className="text-2xl font-black bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent uppercase tracking-wider text-center md:text-left">
              All In One Reborn
            </h1>
            
            <div className="w-full md:w-80 flex-grow max-w-md mx-auto md:mx-0">
              <input
                type="text"
                placeholder="🔍 চ্যানেল বা খেলা খুঁজুন..."
                className="w-full px-4 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700/50 text-white placeholder-slate-400 focus:outline-none focus:border-red-500 transition-all text-sm backdrop-blur-sm shadow-inner"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-3">
              {session ? (
                <div className="flex items-center gap-3 bg-slate-800/50 px-4 py-2 rounded-xl border border-slate-700/50 shadow-md">
                  <div className="text-right flex flex-col items-end gap-1">
                    <p className="text-sm font-bold">{session.user?.name}</p>
                    {isPremium ? (
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] bg-gradient-to-r from-yellow-400 to-yellow-600 text-black px-2 py-0.5 rounded-full font-bold uppercase tracking-wider shadow">Premium VIP</span>
                        
                        <button 
                          onClick={() => setShowM3uModal(true)} 
                          className="text-[10px] bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-3 py-0.5 rounded-full font-bold uppercase tracking-wider transition-all shadow-md flex items-center gap-1"
                        >
                          📺 M3U URL
                        </button>
                      </div>
                    ) : (
                      <Link href="/premium" className="text-[10px] bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white border border-red-500/30 px-3 py-0.5 rounded-full font-bold uppercase tracking-wider transition-colors shadow-sm">Upgrade to Premium</Link>
                    )}
                  </div>
                  <button onClick={() => signOut()} className="text-xs bg-slate-700/80 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg transition-colors font-medium border border-slate-600/50 ml-2">লগআউট</button>
                </div>
              ) : (
                <Link href="/login" className="bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white font-bold py-2.5 px-6 rounded-xl transition-all shadow-lg shadow-red-500/25 whitespace-nowrap border border-red-500/50">
                  লগিন করুন
                </Link>
              )}
            </div>
          </div>
        </header>

        <main className="max-w-[1600px] mx-auto px-4 py-8">
          
          {!isPremium && (
            <div className="w-full flex items-center justify-center mb-8">
              <NativeBanner />
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="w-12 h-12 border-4 border-red-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-slate-400 font-medium animate-pulse">লাইভ স্ট্রিমগুলো লোড হচ্ছে...</p>
            </div>
          ) : filteredStreams.length === 0 ? (
            <div className="text-center py-20 bg-slate-900/50 rounded-2xl border border-slate-800/50 backdrop-blur-sm">
              <span className="text-5xl mb-4 block">📡</span>
              <p className="text-xl text-slate-300 font-medium">এই মুহূর্তে কোনো লাইভ স্ট্রিম সচল নেই।</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-4 md:gap-6">
              {filteredStreams.map((stream) => (
                <div
                  key={stream._id}
                  className="group bg-slate-900/80 backdrop-blur-sm border border-slate-800/80 rounded-2xl overflow-hidden hover:border-red-500/50 hover:shadow-lg hover:shadow-red-500/10 transition-all duration-300 flex flex-col"
                >
                  <div className="aspect-video w-full bg-slate-950 relative overflow-hidden flex items-center justify-center border-b border-slate-800">
                    {stream.logo && stream.logo.startsWith('http') ? (
                      <img
                        src={`https://wsrv.nl/?url=${encodeURIComponent(stream.logo)}&w=400&h=225&fit=contain`}
                        alt={stream.title}
                        className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = "https://placehold.co/600x400/1e293b/ef4444?text=LIVE+TV&font=montserrat";
                        }}
                      />
                    ) : (
                      <span className="text-4xl">📺</span>
                    )}
                    <span className="absolute top-2 left-2 bg-red-600/90 backdrop-blur text-[10px] sm:text-xs font-black uppercase px-2 py-0.5 rounded-md tracking-wider animate-pulse shadow-md border border-red-500/50 z-10">
                      LIVE
                    </span>
                  </div>

                  <div className="p-4 flex flex-col flex-grow justify-between gap-3">
                    <div>
                      <span className="text-[10px] sm:text-[11px] font-bold text-red-400 uppercase tracking-wide block mb-1 line-clamp-1">
                        {stream.group || 'Live Sports'}
                      </span>
                      <h3 className="font-semibold text-sm sm:text-base line-clamp-2 text-slate-200 group-hover:text-white transition-colors">
                        {stream.title}
                      </h3>
                    </div>
                    
                    <a
                      href={`/watch/${stream.short_id}`}
                      className="w-full text-center bg-slate-800/50 hover:bg-gradient-to-r hover:from-red-600 hover:to-orange-600 text-white text-xs sm:text-sm font-bold py-2.5 px-4 rounded-xl transition-all duration-300 border border-slate-700/50 group-hover:border-transparent shadow-sm"
                    >
                      সরাসরি দেখুন
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!isPremium && (
            <div className="w-full flex items-center justify-center mt-8">
              <AdBanner />
            </div>
          )}
        </main>
      </div>

      {/* 🎯 সুন্দর M3U Playlist পপআপ বক্স */}
      {showM3uModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700/50 rounded-3xl max-w-md w-full p-6 relative shadow-2xl animate-in fade-in zoom-in duration-200">
            
            <h3 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-orange-400 mb-2 flex items-center gap-2">
              📺 M3U Playlist URL
            </h3>
            <p className="text-xs text-slate-400 mb-5 leading-relaxed">
              যেকোনো আইপিটিভি অ্যাপে (যেমন: <span className="text-white font-semibold">TiviMate</span> বা <span className="text-white font-semibold">IPTV Smarters Pro</span>) <b>"M3U Link"</b> হিসেবে নিচের লিংকটি কপি করে বসিয়ে দিন।
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">আপনার ব্যক্তিগত M3U লিংক:</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    readOnly 
                    value={`${baseUrl}/api/playlist/${(session?.user as any)?._id}`} 
                    className="w-full bg-slate-950 border border-slate-800 px-3 py-3 rounded-xl text-xs font-mono text-green-400 select-all outline-none shadow-inner" 
                  />
                  <button 
                    onClick={() => { 
                      navigator.clipboard.writeText(`${baseUrl}/api/playlist/${(session?.user as any)?._id}`); 
                      alert("✅ M3U Link কপি হয়েছে!"); 
                    }} 
                    className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-5 rounded-xl text-xs font-bold transition-all shadow-md whitespace-nowrap"
                  >
                    Copy
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-6 bg-red-500/10 border border-red-500/20 p-4 rounded-xl text-[11px] text-red-300 leading-relaxed shadow-inner">
              ⚠️ <b>সতর্কতা:</b> এই লিংকটি শুধুমাত্র আপনার ব্যবহারের জন্য। অন্য কারো সাথে শেয়ার করলে আপনার প্রিমিয়াম অ্যাকাউন্ট স্বয়ংক্রিয়ভাবে ব্লক হয়ে যাবে।
            </div>

            <button onClick={() => setShowM3uModal(false)} className="mt-5 w-full bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold py-3.5 rounded-xl text-sm transition-all shadow-sm">
              বন্ধ করুন
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
