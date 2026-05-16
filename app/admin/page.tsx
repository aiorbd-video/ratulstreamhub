// ফাইল পাথ: app/admin/page.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function AdminPanel() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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
        fetchRequests(); // লিস্ট রিফ্রেশ করা
      } else {
        alert("❌ " + data.message);
      }
    } catch (error) {
      alert("সার্ভার এরর!");
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans p-4 md:p-8 relative">
      <div className="max-w-5xl mx-auto relative z-10">
        
        <div className="flex justify-between items-center mb-8 border-b border-slate-800 pb-4">
          <h1 className="text-3xl font-black text-red-500 uppercase tracking-wider">Super Admin Panel</h1>
          <Link href="/" className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg font-medium transition-colors">হোমে যান</Link>
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
                  ✅ Approve & Make Premium
                </button>
                
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
