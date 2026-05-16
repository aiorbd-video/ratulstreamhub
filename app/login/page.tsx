// ফাইল পাথ: app/login/page.tsx
'use client';

import { useState, Suspense } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isRegistered = searchParams.get('registered');
  
  const [form, setForm] = useState({ phone: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const res = await signIn('credentials', {
      redirect: false,
      phone: form.phone,
      password: form.password,
    });

    setLoading(false);

    if (res?.error) {
      setError(res.error);
    } else {
      router.push('/'); // লগিন সফল হলে হোমপেজে চলে যাবে
      router.refresh();
    }
  };

  return (
    <div className="w-full max-w-md bg-slate-900/80 backdrop-blur-xl border border-slate-800 p-8 rounded-2xl shadow-2xl relative z-10">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-black bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent uppercase tracking-wider mb-2">
          All In One Reborn
        </h1>
        <p className="text-slate-400">প্রিমিয়াম স্ট্রিমিংয়ে লগিন করুন</p>
      </div>

      {isRegistered && <div className="bg-green-500/10 border border-green-500/50 text-green-500 text-sm p-3 rounded-xl mb-6 text-center">অ্যাকাউন্ট তৈরি সফল! এবার লগিন করুন।</div>}
      {error && <div className="bg-red-500/10 border border-red-500/50 text-red-500 text-sm p-3 rounded-xl mb-6 text-center">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">মোবাইল নাম্বার</label>
          <input type="tel" required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-red-500 transition-all" placeholder="017XXXXXXXX" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">পাসওয়ার্ড</label>
          <input type="password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-500 focus:outline-none focus:border-red-500 transition-all" placeholder="••••••••" />
        </div>

        <button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-red-500/25 disabled:opacity-50">
          {loading ? 'লগিন হচ্ছে...' : 'লগিন করুন'}
        </button>
      </form>

      <p className="text-center text-sm text-slate-400 mt-6">
        অ্যাকাউন্ট নেই? <Link href="/register" className="text-red-500 hover:text-red-400 font-semibold transition-colors">নতুন তৈরি করুন</Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4 relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80vw] h-[80vw] md:w-[40vw] md:h-[40vw] rounded-full bg-red-600/20 blur-[120px] pointer-events-none"></div>
      <Suspense fallback={<div className="text-white">লোড হচ্ছে...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
