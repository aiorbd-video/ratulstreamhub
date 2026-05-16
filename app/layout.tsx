// ফাইল পাথ: app/layout.tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from 'next/script';
import "./globals.css";
import AuthProvider from './components/AuthProvider';

// 🌟 প্রিমিয়াম ফন্ট সেটআপ
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// 🌟 ওয়েবসাইটের এসইও (SEO) এবং মেটাডেটা
export const metadata: Metadata = {
  title: 'All In One Reborn | Live Sports',
  description: 'Premium streaming hub for live sports and TV.',
  themeColor: '#0f172a', // মোবাইলের ব্রাউজার বারের কালার ডার্ক দেখানোর জন্য
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} antialiased`}
    >
      <body className="min-h-screen bg-slate-950 text-white font-sans flex flex-col">
        
        {/* মূল ওয়েবসাইট কন্টেন্ট */}
        {children}

        {/* 💰 Adsterra Popunder (গ্লোবাল অ্যাড) */}
        <Script 
          src="https://momrollback.com/d6/33/75/d63375da536c367103a4664c302a2101.js" 
          strategy="lazyOnload" 
        />
        
        {/* 💰 Adsterra Social Bar (গ্লোবাল অ্যাড) */}
        <Script 
          src="https://momrollback.com/0c/d5/88/0cd588cbd2e534cc84cf309218b813ee.js" 
          strategy="lazyOnload" 
        />
        
      </body>
    </html>
  );
}
