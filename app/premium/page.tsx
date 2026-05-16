// ফাইল পাথ: app/premium/page.tsx
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

  // আপনার রিসিভার নাম্বারগুলো এখানে দিন
  const BKASH_NUMBER = "01910254667"; 
  const NAGAD_NUMBER = "01910254667";

  if (status === "unauthenticated") {
    router.push('/login');
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      // এই API টি আমরা পরের ধাপে বানাবো
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
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[60vw] h-[40vw] rounded-full bg-yellow-500/10 blur-[120px] pointer-events-none"></div>

      <div className="max-w-3xl mx-auto relative z-10">
        <Link href="/" className="inline-flex items-center text-slate-400 hover:text-red-500 transition-colors mb-6 text-sm font-medium bg-slate-900 px-4 py-2 rounded-lg border border-slate-800">
          <span>← হোম পেজে ফিরে যান</span>
        </Link>

        <div className="text-center mb-10">
          <h1 className="text-3xl md:text-5xl font-black bg-gradient-to-r from-yellow-400 to-yellow-600 bg-clip-text text-transparent uppercase tracking-wider mb-4">
            Upgrade to Premium VIP
          </h1>
          <p className="text-slate-400 text-lg">অ্যাড-ফ্রি নিরবচ্ছিন্ন স্ট্রিমিং উপভোগ করুন। যেকোনো একটি প্যাকেজ বেছে নিন।</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-10">
          {/* Package 1 */}
          <div onClick={() => setForm({ ...form, package: '1_month' })} className={`cursor-pointer rounded-2xl p-6 border-2 transition-all ${form.package === '1_month' ? 'border-yellow-500 bg-yellow-500/10 shadow-lg shadow-yellow-500/20' : 'border-slate-800 bg-slate-900 hover:border-slate-600'}`}>
            <h3 className="text-xl font-bold text-white mb-2">১ মাস (30 Days)</h3>
            <div className="text-3xl font-black text-yellow-500 mb-4">৳ ৫০</div>
            <ul className="text-sm text-slate-300 space-y-2">
              <li>✅ 100% Ad-Free Experience</li>
              <li>✅ 4K UHD Streaming Support</li>
              <li>✅ Priority Support</li>
            </ul>
          </div>
          
          {/* Package 2 */}
          <div onClick={() => setForm({ ...form, package: '6_months' })} className={`cursor-pointer rounded-2xl p-6 border-2 transition-all relative ${form.package === '6_months' ? 'border-yellow-500 bg-yellow-500/10 shadow-lg shadow-yellow-500/20' : 'border-slate-800 bg-slate-900 hover:border-slate-600'}`}>
            <span className="absolute -top-3 right-4 bg-gradient-to-r from-red-500 to-orange-500 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">Save 16%</span>
            <h3 className="text-xl font-bold text-white mb-2">৬ মাস (180 Days)</h3>
            <div className="text-3xl font-black text-yellow-500 mb-4">৳ ২৫০</div>
            <ul className="text-sm text-slate-300 space-y-2">
              <li>✅ 100% Ad-Free Experience</li>
              <li>✅ 4K UHD Streaming Support</li>
              <li>✅ Priority Support</li>
            </ul>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 md:p-8">
          <h2 className="text-xl font-bold mb-6 border-b border-slate-800 pb-4">পেমেন্ট সাবমিট করুন</h2>
          
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 mb-6">
            <p className="text-sm text-slate-300 mb-2">১. নিচের নাম্বারে Send Money করুন:</p>
            <p className="font-mono text-lg text-white font-bold mb-1"><span className="text-pink-500">bKash:</span> {BKASH_NUMBER}</p>
            <p className="font-mono text-lg text-white font-bold"><span className="text-orange-500">Nagad:</span> {NAGAD_NUMBER}</p>
          </div>

          {message && (
            <div className={`p-4 rounded-xl mb-6 text-sm font-medium border ${message.includes('✅') ? 'bg-green-500/10 border-green-500/50 text-green-400' : 'bg-red-500/10 border-red-500/50 text-red-400'}`}>
              {message}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
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

            <button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 text-black font-black py-4 rounded-xl transition-all shadow-lg shadow-yellow-500/25 disabled:opacity-50 mt-4 text-lg">
              {loading ? 'সাবমিট হচ্ছে...' : 'পেমেন্ট কনফার্ম করুন'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
              }
