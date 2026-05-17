// ফাইল পাথ: app/components/GlobalAds.tsx
'use client';

import { useSession } from 'next-auth/react';
import Script from 'next/script';

export default function GlobalAds() {
  const { data: session } = useSession();
  
  // চেক করা হচ্ছে ইউজার প্রিমিয়াম কি না
  const isPremium = (session?.user as any)?.isPremium === true;

  // ইউজার প্রিমিয়াম হলে কোনো অ্যাড স্ক্রিপ্ট লোড হবে না!
  if (isPremium) {
    return null; 
  }

  return (
    <>
      {/* 💰 Adsterra Popunder */}
      <Script src="https://momrollback.com/d6/33/75/d63375da536c367103a4664c302a2101.js" strategy="lazyOnload" />
      
      {/* 💰 Adsterra Social Bar */}
      <Script src="https://momrollback.com/0c/d5/88/0cd588cbd2e534cc84cf309218b813ee.js" strategy="lazyOnload" />
    </>
  );
}
