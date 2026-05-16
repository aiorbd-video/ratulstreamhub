// ফাইল পাথ: app/admin/page.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function AdminPanel() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // 🎯 M3U Sync এর জন্য স্টেট
  const [m3uLinks, setM3uLinks] = useState('');
  const [syncing, setSyncing] = useState(false);

  const fetchRequests = async () => {
    try {
      const res = await fetch('/api/admin/pending');
      const data = await res.json();
      if (data.success) {
        setRequests(data.requests);
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleApprove = async (paymentId: string, userId: string, pkg: string) => {
    if (!confirm("আপনি কি নিশ্চিত এই ইউজারকে প্রিমিয়াম করতে চান?")) return;

    try {
      const res = await fetch('/api/admin/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId, userId, pkg }),
      });
      const data = await res.json();
      
      if (res.ok) {
        alert("✅ " + data.message);
        fetchRequests();
      } else {
        alert("❌ " + data.message);
      }
    } catch (error) {
      alert("সার্ভার এরর!");
    }
  };

  // 🎯 M3U Sync ফাংশন
  const handleSyncM3U = async () => {
    if (!m3uLinks.trim()) {
      alert("আগে লিংক বসান!");
      return;
    }
    setSyncing(true);
    try {
      // প্রতিটি লাইনের লিংক আলাদা করে Array তে নেওয়া হচ্ছে
      const urls = m3uLinks.split('\n').map(l => l.trim()).filter(l => l.length > 5);
      const res = await fetch('/api/admin/m3u-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls }),
      });
      const data = await res.json();
      if (res.ok) {
        alert("✅ " + data.message);
        setM3uLinks('');
      } else {
        alert("❌ " + data.message);
      }
    } catch (error) {
      alert("সার্ভার এরর!");
    }
    setSyncing(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans p-4 md:p-8 relative">
      <div className="max-w-5xl mx-auto relative z-10">
        
        <div className="flex justify-between items-center mb-8 border-b border-slate-800 pb-4">
          <h1 className="text-3xl font-black text-red-500 uppercase tracking-wider">Super Admin</h1>
          <Link href="/" className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg font-medium transition-colors">হোমে যান</Link>
        </div>

        {/* 🎯 Premium M3U Manager Section */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-10">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-yellow-500">
            📺 Premium M3U Link Manager
          </h2>
          <p className="text-sm text-slate-400 mb-4">
            এখানে আপনার কাছে থাকা প্রিমিয়াম M3U লিংকগুলো দিন (প্রতি লাইনে একটি করে)। সিংক করলে এগুলো ইউজারদের পার্সোনাল লিংকে যুক্ত হয়ে যাবে।
          </p>
          <textarea 
            value={m3uLinks}
            onChange={(e) => setM3uLinks(e.target.value)}
            placeholder="http://example.com/playlist1.m3u&#10;http://test.com/playlist2.m3u"
            className="w-full h-32 px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-600 focus:outline-none focus:border-yellow-500 transition-colors mb-4 font-mono text-sm"
          />
          <button 
            onClick={handleSyncM3U}
            disabled={syncing}
            className="bg-yellow-600 hover:bg-yellow-500 text-black font-bold py-3 px-6 rounded-xl transition-all shadow-lg shadow-yellow-600/20 disabled:opacity-50"
          >
            {syncing ? 'Syncing & Merging...' : '⚡ Sync & Merge Links'}
          </button>
        </div>

        <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
          পেন্ডিং পেমেন্ট রিকোয়েস্ট 
          <span className="bg-orange-500 text-black px-3 py-1 rounded-full text-sm">{requests.length}</span>
        </h2>

        {loading ? (
          <div className="animate-pulse text-slate-400">ডেটা লোড হচ্ছে...</div>
        ) : requests.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 text-center text-slate-400">
            কোনো পেন্ডিং রিকোয়েস্ট নেই।
          </div>
        ) : (
          <div className="grid gap-4">
            {requests.map((req) => (
              <div key={req._id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="bg-slate-800 text-slate-300 px-2 py-1 rounded text-xs font-mono">{req.phone}</span>
                    <span className="bg-blue-500/20 text-blue-400 px-2 py-1 rounded text-xs font-bold uppercase">{req.package === '1_month' ? '1 Month' : '6 Months'}</span>
                  </div>
                  <p className="text-slate-300 text-sm">
                    <span className="font-medium text-slate-400">Method:</span> <span className="uppercase font-bold text-white">{req.method}</span> | 
                    <span className="font-medium text-slate-400 ml-3">Sender:</span> <span className="font-mono text-white">{req.senderNumber}</span>
                  </p>
                  <p className="text-slate-300 text-sm mt-1">
                    <span className="font-medium text-slate-400">TrxID:</span> <span className="font-mono text-yellow-400 font-bold">{req.trxId}</span>
                  </p>
                </div>
                <button 
                  onClick={() => handleApprove(req._id, req.userId, req.package)}
                  className="bg-green-600 hover:bg-green-500 text-white font-bold py-2.5 px-6 rounded-xl transition-all shadow-lg shadow-green-600/20 whitespace-nowrap"
                >
                  ✅ Approve Premium
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
