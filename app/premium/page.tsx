'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function PremiumPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [form, setForm] = useState({ package: '1_month', method: 'bkash', senderNumber: '', trxId: '' });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // 🎯 আপনার বিকাশ ও নগদ নাম্বার এখানে বসান
  const BKASH_NUMBER = "017XXXXXXXX"; 
  const NAGAD_NUMBER = "017XXXXXXXX";

  if (status === "unauthenticated") {
    router.push('/login');
    return null;
  }

  // ⚡ ফ্রি ট্রায়াল অ্যাক্টিভেট করার ফাংশন
  const handleActivateTrial = async () => {
    setLoading(true);
    setMessage('');
    try {
      const res = await fetch('/api/payment/trial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: (session?.user as any)?.id }),
      });
      const data = await res.json();
      
      if (res.ok) {
        setMessage(`✅ ${data.message}`);
        setTimeout(() => {
          router.push('/');
          router.refresh();
        }, 3000);
      } else {
        setMessage(`❌ ${data.message}`);
      }
    } catch (error) {
      setMessage('❌ ট্রায়াল চালু করতে সমস্যা হয়েছে! পরে চেষ্টা করুন।');
    }
    setLoading(false);
  };

  // 💰 পেইড পেমেন্ট সাবমিট করার ফাংশন
  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const res = await fetch('/api/payment/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, userId: (session?.user as any)?.id, phone: (session?.user as any)?.phone }),
      });
      const data = await res.json();
      
      if (res.ok) {
        setMessage('✅ আপনার পেমেন্ট সফলভাবে সাবমিট হয়েছে! অ্যাডমিন চেক করে খুব শিগগিরই আপনার অ্যাকাউন্ট প্রিমিয়াম করে দেবে।');
        setForm({ ...form, senderNumber: '', trxId: '' });
      } else {
        setMessage(`❌ ${data.message}`);
      }
    } catch (error) {
      setMessage('❌ সার্ভার এরর! দয়া করে একটু পর আবার চেষ্টা করুন।');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans py-10 px-4 relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[70vw] h-[40vw] rounded-full bg-red-600/10 blur-[140px] pointer-events-none"></div>

      <div className="max-w-4xl mx-auto relative z-10">
        <Link href="/" className="inline-flex items-center text-slate-400 hover:text-red-500 transition-colors mb-8 text-sm font-medium bg-slate-900 px-4 py-2 rounded-xl border border-slate-800">
          <span>← হোম পেজে ফিরে যান</span>
        </Link>

        {/* 🔥 আকর্ষনীয় মার্কেটিং ব্যানার ও হেডার */}
        <div className="text-center mb-12">
          <span className="bg-gradient-to-r from-amber-500 to-orange-500 text-black font-black text-xs px-4 py-1.5 rounded-full uppercase tracking-widest shadow-md mb-4 inline-block">
            📢 LIMITED TIME OFFER
          </span>
          <h1 className="text-3xl md:text-6xl font-black bg-gradient-to-r from-yellow-400 via-orange-500 to-red-500 bg-clip-text text-transparent uppercase tracking-wider mb-4 leading-tight">
            Upgrade to Premium VIP
          </h1>
          <p className="text-slate-300 text-base md:text-xl max-w-2xl mx-auto leading-relaxed">
            কোনো প্রকার বাফারিং বা বিরক্তিকর অ্যাড ছাড়াই উপভোগ করুন দেশি-বিদেশী সব প্রিমিয়াম চ্যানেল সরাসরি আপনার মোবাইল, পিসি কিংবা স্মার্ট টিভিতে!
          </p>
        </div>

        {/* ✨ আমাদের বিশেষ আকর্ষণীয় ফিচার লিস্ট (কেন কিনবে ইউজার?) */}
        <div className="bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-6 md:p-8 mb-10 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/5 rounded-full blur-2xl"></div>
          <h2 className="text-xl md:text-2xl font-black text-yellow-500 mb-6 flex items-center gap-2 border-b border-slate-800/80 pb-3">
            💎 VIP মেম্বারশিপের এক্সক্লুসিভ সুবিধাসমূহ:
          </h2>
          <div className="grid sm:grid-cols-2 gap-4 text-sm md:text-base">
            <div className="flex items-start gap-3 bg-slate-950/60 p-4 rounded-xl border border-slate-900">
              <span className="text-xl">📺</span>
              <p className="text-slate-200 font-medium"><strong className="text-white block font-bold text-base mb-0.5">১০০০+ লাইভ চ্যানেল</strong> Toffee, SonyLiv, Akash Go, Hotstar, Willow TV সহ দেশী-বিদেশী ১০০০+ পেইড চ্যানেল সম্পূর্ণ ফ্রি!</p>
            </div>
            <div className="flex items-start gap-3 bg-slate-950/60 p-4 rounded-xl border border-slate-900">
              <span className="text-xl">🚫</span>
              <p className="text-slate-200 font-medium"><strong className="text-white block font-bold text-base mb-0.5">১০০% অ্যাড-ফ্রি (No Ads)</strong> খেলা বা ভিডিওর মাঝে কোনো পপআপ বা ব্যানার অ্যাড আসবে না। একদম ক্লিন এক্সপেরিয়েন্স!</p>
            </div>
            <div className="flex items-start gap-3 bg-slate-950/60 p-4 rounded-xl border border-slate-900">
              <span className="text-xl">📋</span>
              <p className="text-slate-200 font-medium"><strong className="text-white block font-bold text-base mb-0.5">পার্সোনাল M3U প্লেলিস্ট</strong> প্লেলিস্ট লিংক কপি করে TiviMate, IPTV Smarters অ্যাপ দিয়ে যেকোনো স্মার্ট টিভিতে সরাসরি দেখতে পারবেন।</p>
            </div>
            <div className="flex items-start gap-3 bg-slate-950/60 p-4 rounded-xl border border-slate-900">
              <span className="text-xl">⚡</span>
              <p className="text-slate-200 font-medium"><strong className="text-white block font-bold text-base mb-0.5">জিরো বাফারিং (High Speed)</strong> হাই-স্পিড ডেডিকেটেড প্রিমিয়াম সার্ভার, তাই লো-ইন্টারনেটেও বাফারিং ছাড়াই স্মুথভাবে চলবে।</p>
            </div>
          </div>
        </div>

        {/* 📦 ৩টি প্যাকেজ অপশন (ফ্রি ট্রায়ালসহ) */}
        <div className="grid md:grid-cols-3 gap-6 mb-10">
          
          {/* Package 0: Free Trial */}
          <div onClick={() => setForm({ ...form, package: 'trial' })} className={`cursor-pointer rounded-2xl p-6 border-2 transition-all flex flex-col justify-between ${form.package === 'trial' ? 'border-blue-500 bg-blue-500/10 shadow-lg shadow-blue-500/20' : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'}`}>
            <div>
              <span className="bg-blue-600/20 text-blue-400 text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider mb-3 inline-block">Test Quality</span>
              <h3 className="text-xl font-bold text-white mb-1">২০ মিনিট ট্রায়াল</h3>
              <p className="text-xs text-slate-400 mb-3">কোয়ালিটি চেক করার জন্য</p>
              <div className="text-3xl font-black text-blue-400 mb-4">৳ ০ <span className="text-xs text-slate-500 font-normal">/একবার</span></div>
            </div>
            <ul className="text-xs text-slate-300 space-y-2 border-t border-slate-800 pt-3">
              <li>✅ ফুল ১০০% অ্যাড-ফ্রি ট্রায়াল</li>
              <li>✅ সব প্রিমিয়াম চ্যানেল ওপেন</li>
              <li>❌ ১টি একাউন্টে মাত্র ১ বার প্রদেয়</li>
            </ul>
          </div>

          {/* Package 1: 1 Month */}
          <div onClick={() => setForm({ ...form, package: '1_month' })} className={`cursor-pointer rounded-2xl p-6 border-2 transition-all flex flex-col justify-between ${form.package === '1_month' ? 'border-yellow-500 bg-yellow-500/10 shadow-lg shadow-yellow-500/20' : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'}`}>
            <div>
              <span className="bg-yellow-600/20 text-yellow-500 text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider mb-3 inline-block">Popular</span>
              <h3 className="text-xl font-bold text-white mb-1">১ মাস (30 Days)</h3>
              <p className="text-xs text-slate-400 mb-3">ফুল মেম্বারশিপ প্যাকেজ</p>
              <div className="text-3xl font-black text-yellow-500 mb-4">৳ ৫০</div>
            </div>
            <ul className="text-xs text-slate-300 space-y-2 border-t border-slate-800 pt-3">
              <li>✅ ১০০% অ্যাড-ফ্রি এক্সপেরিয়েন্স</li>
              <li>✅ স্মার্ট টিভি M3U লিংক সাপোর্ট</li>
              <li>✅ ২৪/৭ প্রায়োরিটি কাস্টমার সাপোর্ট</li>
            </ul>
          </div>
          
          {/* Package 2: 6 Months */}
          <div onClick={() => setForm({ ...form, package: '6_months' })} className={`cursor-pointer rounded-2xl p-6 border-2 transition-all flex flex-col justify-between relative ${form.package === '6_months' ? 'border-red-500 bg-red-500/10 shadow-lg shadow-red-500/20' : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'}`}>
            <span className="absolute -top-3 right-4 bg-gradient-to-r from-red-500 to-orange-500 text-white text-[9px] font-black px-3 py-1 rounded-full uppercase tracking-wider">Best Value</span>
            <div>
              <span className="bg-red-600/20 text-red-400 text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider mb-3 inline-block">Mega Saver</span>
              <h3 className="text-xl font-bold text-white mb-1">৬ মাস (180 Days)</h3>
              <p className="text-xs text-slate-400 mb-3">দীর্ঘমেয়াদী নিশ্চিন্ত সেবা</p>
              <div className="text-3xl font-black text-red-500 mb-4">৳ ২৫०</div>
            </div>
            <ul className="text-xs text-slate-300 space-y-2 border-t border-slate-800 pt-3">
              <li>✅ ১ মাসের চেয়ে ১৬% সাশ্রয়ী</li>
              <li>✅ স্মার্ট টিভি M3U লিংক সাপোর্ট</li>
              <li>✅ আল্ট্রা হাই-স্পিড ডেডিকেটেড সার্ভার</li>
            </ul>
          </div>
        </div>

        {/* 🎯 ডাইনামিক ফর্ম এরিয়া (প্যাকেজ সিলেকশনের ওপর ভিত্তি করে ফর্ম বদলাবে) */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8">
          
          {message && (
            <div className={`p-4 rounded-xl mb-6 text-sm font-medium border ${message.includes('✅') ? 'bg-green-500/10 border-green-500/50 text-green-400' : 'bg-red-500/10 border-red-500/50 text-red-400'}`}>
              {message}
            </div>
          )}

          {form.package === 'trial' ? (
            /* 🎁 ফ্রি ট্রায়ালের জন্য সিম্পল ওয়ান-ক্লিক বাটন */
            <div className="text-center py-4">
              <h3 className="text-lg font-bold text-white mb-2">আপনি ২০ মিনিটের ফ্রি ট্রায়াল সিলেক্ট করেছেন</h3>
              <p className="text-sm text-slate-400 mb-6">নিচের বাটনে ক্লিক করা মাত্রই আপনার অ্যাকাউন্টে তাৎক্ষণিকভাবে প্রিমিয়াম ফিচার একটিভ হয়ে যাবে।</p>
              <button 
                onClick={handleActivateTrial}
                disabled={loading}
                className="w-full max-w-md bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black py-4 rounded-xl transition-all shadow-lg shadow-blue-500/25 text-lg disabled:opacity-50"
              >
                {loading ? 'ট্রায়াল একটিভ হচ্ছে...' : '⚡ এখনই ফ্রি ট্রায়াল শুরু করুন'}
              </button>
            </div>
          ) : (
            /* 💰 পেইড প্যাকেজের জন্য পেমেন্ট গেটওয়ে ফর্ম */
            <>
              <h2 className="text-xl font-bold mb-6 border-b border-slate-800 pb-4">পেমেন্ট সাবমিট করুন</h2>
              
              <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 mb-6">
                <p className="text-sm text-slate-300 mb-2">১. নিচের যেকোনো নাম্বারে ক্যাশ-ইন / সেন্ড মানি (Send Money) করুন:</p>
                <p className="font-mono text-base md:text-lg text-white font-bold mb-1"><span className="text-pink-500 font-bold">bKash (Personal):</span> {BKASH_NUMBER}</p>
                <p className="font-mono text-base md:text-lg text-white font-bold"><span className="text-orange-500 font-bold">Nagad (Personal):</span> {NAGAD_NUMBER}</p>
              </div>

              <form onSubmit={handleSubmitPayment} className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <button type="button" onClick={() => setForm({ ...form, method: 'bkash' })} className={`py-3 rounded-xl font-bold transition-all ${form.method === 'bkash' ? 'bg-pink-600 text-white shadow-lg shadow-pink-600/30' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>bKash</button>
                  <button type="button" onClick={() => setForm({ ...form, method: 'nagad' })} className={`py-3 rounded-xl font-bold transition-all ${form.method === 'nagad' ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/30' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>Nagad</button>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">যে নাম্বার থেকে টাকা পাঠিয়েছেন</label>
                  <input type="tel" required value={form.senderNumber} onChange={(e) => setForm({ ...form, senderNumber: e.target.value })} className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:border-yellow-500 outline-none transition-colors" placeholder="017XXXXXXXX" />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1.5">TrxID (ট্রানজেকশন আইডি)</label>
                  <input type="text" required value={form.trxId} onChange={(e) => setForm({ ...form, trxId: e.target.value })} className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:border-yellow-500 outline-none transition-colors font-mono" placeholder="7A8B9CDE10" />
                </div>

                <button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-yellow-400 to-amber-500 hover:from-yellow-300 hover:to-amber-400 text-black font-black py-4 rounded-xl transition-all shadow-lg shadow-yellow-500/25 disabled:opacity-50 mt-4 text-lg">
                  {loading ? 'সাবমিট হচ্ছে...' : 'পেমেন্ট কনফার্ম করুন'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
