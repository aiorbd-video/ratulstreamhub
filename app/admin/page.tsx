// ফাইল পাথ: app/admin/page.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState('payments'); // Tab State
  
  const [requests, setRequests] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [m3uLinks, setM3uLinks] = useState('');
  const [syncing, setSyncing] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [reqRes, userRes, m3uRes] = await Promise.all([
        fetch('/api/admin/pending'),
        fetch('/api/admin/users'),
        fetch('/api/admin/m3u-sync')
      ]);
      
      const reqData = await reqRes.json();
      const userData = await userRes.json();
      const m3uData = await m3uRes.json();

      if (reqData.success) setRequests(reqData.requests);
      if (userData.success) setUsers(userData.users);
      if (m3uData.urls) setM3uLinks(m3uData.urls.join('\n')); // সেভ করা লিংকগুলো টেক্সট এরিয়ায় বসাচ্ছে

    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // 🎯 পেমেন্ট এপ্রুভ ফাংশন
  const handleApprove = async (paymentId: string, userId: string, pkg: string) => {
    if (!confirm("আপনি কি নিশ্চিত এই ইউজারকে প্রিমিয়াম করতে চান?")) return;
    try {
      const res = await fetch('/api/admin/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId, userId, pkg }),
      });
      const data = await res.json();
      if (res.ok) { alert("✅ " + data.message); fetchData(); } 
      else { alert("❌ " + data.message); }
    } catch (error) { alert("সার্ভার এরর!"); }
  };

  // 🎯 ইউজার ডিলিট/এডিট ফাংশন
  const handleUserAction = async (userId: string, action: string, premiumStatus?: boolean) => {
    if (action === 'delete' && !confirm("সতর্কতা! আপনি কি নিশ্চিত এই ইউজারকে ডিলিট করবেন?")) return;
    try {
      const res = await fetch('/api/admin/users/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, action, premiumStatus }),
      });
      const data = await res.json();
      if (res.ok) { alert("✅ " + data.message); fetchData(); } 
      else { alert("❌ " + data.message); }
    } catch (error) { alert("সার্ভার এরর!"); }
  };

  // 🎯 M3U Sync ফাংশন (এডিট এবং ডিলিট সহ)
  const handleSyncM3U = async () => {
    setSyncing(true);
    try {
      const urls = m3uLinks.split('\n').map(l => l.trim()).filter(l => l.length > 5);
      const res = await fetch('/api/admin/m3u-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls }),
      });
      const data = await res.json();
      if (res.ok) { alert("✅ " + data.message); fetchData(); } 
      else { alert("❌ " + data.message); }
    } catch (error) { alert("সার্ভার এরর!"); }
    setSyncing(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans p-4 md:p-8 relative">
      <div className="max-w-6xl mx-auto relative z-10">
        
        <div className="flex justify-between items-center mb-8 border-b border-slate-800 pb-4">
          <h1 className="text-3xl font-black text-red-500 uppercase tracking-wider">Super Admin</h1>
          <Link href="/" className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg font-medium transition-colors">হোমে যান</Link>
        </div>

        {/* 🎯 TABS NAV */}
        <div className="flex gap-4 mb-8 overflow-x-auto pb-2 border-b border-slate-800">
          <button onClick={() => setActiveTab('payments')} className={`px-6 py-3 rounded-xl font-bold transition-all whitespace-nowrap ${activeTab === 'payments' ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/20' : 'bg-slate-900 text-slate-400 hover:bg-slate-800'}`}>
            পেমেন্ট রিকোয়েস্ট ({requests.length})
          </button>
          <button onClick={() => setActiveTab('users')} className={`px-6 py-3 rounded-xl font-bold transition-all whitespace-nowrap ${activeTab === 'users' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'bg-slate-900 text-slate-400 hover:bg-slate-800'}`}>
            ইউজার ম্যানেজমেন্ট ({users.length})
          </button>
          <button onClick={() => setActiveTab('m3u')} className={`px-6 py-3 rounded-xl font-bold transition-all whitespace-nowrap ${activeTab === 'm3u' ? 'bg-yellow-600 text-white shadow-lg shadow-yellow-600/20' : 'bg-slate-900 text-slate-400 hover:bg-slate-800'}`}>
            M3U ম্যানেজার
          </button>
        </div>

        {loading ? (
          <div className="animate-pulse text-slate-400">ডেটা লোড হচ্ছে...</div>
        ) : (
          <>
            {/* 🎯 TAB: PAYMENTS */}
            {activeTab === 'payments' && (
              <div className="grid gap-4">
                {requests.length === 0 ? <p className="text-slate-400 p-6 bg-slate-900 rounded-xl text-center">কোনো পেন্ডিং পেমেন্ট নেই।</p> : 
                  requests.map((req) => (
                    <div key={req._id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <span className="bg-slate-800 text-slate-300 px-2 py-1 rounded text-xs font-mono">{req.phone}</span>
                          <span className="bg-blue-500/20 text-blue-400 px-2 py-1 rounded text-xs font-bold uppercase">{req.package === '1_month' ? '1 Month' : '6 Months'}</span>
                        </div>
                        <p className="text-slate-300 text-sm">
                          <span className="font-medium text-slate-400">Method:</span> <span className="uppercase font-bold text-white">{req.method}</span> | 
                          <span className="font-medium text-slate-400 ml-3">Sender:</span> <span className="font-mono text-white">{req.senderNumber}</span> | 
                          <span className="font-medium text-slate-400 ml-3">TrxID:</span> <span className="font-mono text-yellow-400 font-bold">{req.trxId}</span>
                        </p>
                      </div>
                      <button onClick={() => handleApprove(req._id, req.userId, req.package)} className="bg-green-600 hover:bg-green-500 text-white font-bold py-2.5 px-6 rounded-xl transition-all shadow-lg whitespace-nowrap">
                        ✅ Approve Premium
                      </button>
                    </div>
                  ))
                }
              </div>
            )}

            {/* 🎯 TAB: USERS */}
            {activeTab === 'users' && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm text-slate-400">
                    <thead className="text-xs uppercase bg-slate-800 text-slate-300">
                      <tr>
                        <th className="px-6 py-4">Name & Phone</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4">Expiry Date</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map(user => (
                        <tr key={user._id} className="border-b border-slate-800 hover:bg-slate-800/50">
                          <td className="px-6 py-4 font-medium text-white">
                            <div>{user.name}</div>
                            <div className="text-xs text-slate-500 font-mono">{user.phone}</div>
                          </td>
                          <td className="px-6 py-4">
                            {user.isPremium ? 
                              <span className="bg-yellow-500/20 text-yellow-500 px-2 py-1 rounded text-xs font-bold uppercase">Premium VIP</span> : 
                              <span className="bg-slate-700 text-slate-300 px-2 py-1 rounded text-xs font-bold uppercase">Free</span>
                            }
                          </td>
                          <td className="px-6 py-4 font-mono text-xs">
                            {user.premiumExpiry ? new Date(user.premiumExpiry).toLocaleDateString() : 'N/A'}
                          </td>
                          <td className="px-6 py-4 flex gap-2 justify-end">
                            <button 
                              onClick={() => handleUserAction(user._id, 'toggle_premium', !user.isPremium)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${user.isPremium ? 'bg-slate-700 hover:bg-slate-600 text-white' : 'bg-green-600 hover:bg-green-500 text-white'}`}
                            >
                              {user.isPremium ? 'Revoke Premium' : 'Make Premium'}
                            </button>
                            <button 
                              onClick={() => handleUserAction(user._id, 'delete')}
                              className="bg-red-500/20 hover:bg-red-600 text-red-500 hover:text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 🎯 TAB: M3U MANAGER */}
            {activeTab === 'm3u' && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-yellow-500">📺 M3U Manager</h2>
                <p className="text-sm text-slate-400 mb-4">
                  আপনার লিঙ্কগুলো নিচে দিন। <b>কোনো লিংক ডিলিট করতে চাইলে, এখান থেকে সেই লাইনটি মুছে দিয়ে Sync বাটনে ক্লিক করুন।</b>
                </p>
                <textarea 
                  value={m3uLinks}
                  onChange={(e) => setM3uLinks(e.target.value)}
                  placeholder="http://example.com/playlist1.m3u"
                  className="w-full h-48 px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder-slate-600 focus:outline-none focus:border-yellow-500 transition-colors mb-4 font-mono text-sm leading-relaxed whitespace-pre"
                />
                <button 
                  onClick={handleSyncM3U}
                  disabled={syncing}
                  className="bg-yellow-600 hover:bg-yellow-500 text-black font-bold py-3 px-6 rounded-xl transition-all shadow-lg shadow-yellow-600/20 disabled:opacity-50"
                >
                  {syncing ? 'Syncing & Merging...' : '⚡ Sync & Update M3U Links'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
