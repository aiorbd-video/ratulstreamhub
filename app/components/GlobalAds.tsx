// ফাইল পাথ: components/GlobalAds.tsx
'use client';

import { useSession } from 'next-auth/react';
import Script from 'next/script';

export default function GlobalAds() {
  // 🎯 ১. শুধু session নয়, status-ও নিতে হবে
  const { data: session, status } = useSession();
  
  // 🎯 ২. ম্যাজিক ব্লকার: যতক্ষণ সেশন লোড হবে (চেক চলবে), ততক্ষণ কোনো অ্যাড স্ক্রিপ্ট রান করবে না
  if (status === 'loading') {
    return null; 
  }

  // ৩. চেক করা হচ্ছে ইউজার প্রিমিয়াম কি না
  const isPremium = (session?.user as any)?.isPremium === true;

  // 🎯 ৪. ইউজার প্রিমিয়াম হলে চিরতরে অ্যাড ব্লক
  if (isPremium) {
    return null; 
  }

  // ৫. শুধুমাত্র ফ্রি এবং গেস্ট ইউজারদের জন্য অ্যাড
  return (
    <>
      {/* 💰 Adsterra Popunder */}
      <Script 
        id="adsterra-popunder"
        src="https://momrollback.com/d6/33/75/d63375da536c367103a4664c302a2101.js" 
        strategy="afterInteractive" 
      />
      
      {/* 💰 Adsterra Social Bar */}
      <Script 
        id="adsterra-socialbar"
        src="https://momrollback.com/0c/d5/88/0cd588cbd2e534cc84cf309218b813ee.js" 
        strategy="afterInteractive" 
      />
    </>
  );
}
