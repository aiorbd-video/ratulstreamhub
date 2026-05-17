// ফাইল পাথ: app/layout.tsx
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import AuthProvider from './components/AuthProvider';
import GlobalAds from './components/GlobalAds';

const inter = Inter({ subsets: ["latin"] });

// 📱 মোবাইল এবং রেস্পন্সিভ ভিউপোর্ট সেটিং (Next.js 14 স্ট্যান্ডার্ড)
export const viewport: Viewport = {
  themeColor: '#0f172a',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

// 🚀 অ্যাডভান্সড SEO এবং মেটাডেটা (Google, Facebook, WhatsApp এর জন্য)
export const metadata: Metadata = {
  metadataBase: new URL('https://ratulstreamhub.vercel.app'), // আপনার ওয়েবসাইটের আসল লিংক
  title: {
    default: 'All In One Reborn | Premium Live Sports & TV',
    template: '%s | All In One Reborn', // অন্য পেজে গেলে ডাইনামিক টাইটেল দেখাবে
  },
  description: 'Experience premium, ad-free live sports, entertainment, and TV channels with All In One Reborn. Join now for exclusive M3U playlists and HD streaming.',
  keywords: ['IPTV', 'Live Sports', 'Streaming', 'M3U Playlist', 'Live TV', 'All In One Reborn', 'Sports Stream', 'Ad-free streaming', 'BD IPTV'],
  authors: [{ name: 'Md Ratul Hasan' }],
  creator: 'Md Ratul Hasan',
  publisher: 'All In One Reborn',
  
  // 🔗 OpenGraph (Facebook, WhatsApp, Messenger এ লিংক শেয়ার করলে যা দেখাবে)
  openGraph: {
    title: 'All In One Reborn | Premium Live Sports & TV',
    description: 'Watch your favorite sports and TV channels live in HD. Get premium access and personal M3U playlists.',
    url: 'https://ratulstreamhub.vercel.app',
    siteName: 'All In One Reborn',
    images: [
      {
        url: 'https://placehold.co/1200x630/0f172a/ef4444?text=All+In+One+Reborn+Live+TV', // লিংক শেয়ার করলে এই ছবিটি দেখাবে
        width: 1200,
        height: 630,
        alt: 'All In One Reborn Live TV',
      },
    ],
    locale: 'bn_BD',
    type: 'website',
  },

  // 🐦 Twitter Card (টুইটারে লিংক শেয়ার করলে যা দেখাবে)
  twitter: {
    card: 'summary_large_image',
    title: 'All In One Reborn | Premium Live Sports & TV',
    description: 'Watch your favorite sports and TV channels live in HD. Get premium access and personal M3U playlists.',
    images: ['https://placehold.co/1200x630/0f172a/ef4444?text=All+In+One+Reborn+Live+TV'],
  },

  // 🤖 সার্চ ইঞ্জিন বট (Google Bot) কে পারমিশন দেওয়া
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="antialiased">
      <body className={`${inter.className} min-h-screen bg-slate-950 text-white font-sans flex flex-col`}>
        
        <AuthProvider>
          
          {/* মূল ওয়েবসাইট কন্টেন্ট */}
          {children}

          {/* 🎯 গ্লোবাল অ্যাড কন্ট্রোলার (প্রিমিয়াম ইউজারদের জন্য অ্যাড অটোমেটিক অফ করে দেবে) */}
          <GlobalAds />
          
        </AuthProvider>

      </body>
    </html>
  );
}
