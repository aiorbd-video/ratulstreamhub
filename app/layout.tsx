// ফাইল পাথ: app/layout.tsx
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import AuthProvider from './components/AuthProvider';
import GlobalAds from './components/GlobalAds';

const inter = Inter({ subsets: ["latin"] });

// 📱 এন্টারপ্রাইজ লেভেল রেস্পন্সিভ ভিউপোর্ট কনফিগারেশন
export const viewport: Viewport = {
  themeColor: '#0f172a',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1, // ইউজার এক্সপেরিয়েন্স অ্যাপের মতো স্মুথ রাখার জন্য
};

// 🚀 আল্টিমেট এন্টারপ্রাইজ এসইও মেটাডেটা বুস্ট
export const metadata: Metadata = {
  metadataBase: new URL('https://ratulstreamhub.vercel.app'),
  title: {
    default: 'All In One Reborn | Premium Live Sports & TV Streaming',
    template: '%s | All In One Reborn', 
  },
  description: 'Experience premium, ad-free live sports, entertainment, and global TV channels with All In One Reborn. Watch buffer-free in Ultra HD with customized M3U playlists.',
  keywords: [
    'IPTV Bangladesh', 'Live Sports Stream', 'Buffer-free Streaming', 'All In One Reborn', 
    'M3U Playlist Premium', 'Live TV Online', 'Toffee Live Proxy', 'SonyLiv HD Bangladesh', 
    'Sports Stream Hub', 'Ad-free IPTV', 'BD IPTV Server', 'Watch Live Cricket HD'
  ],
  authors: [{ name: 'Md Ratul Hasan', url: 'https://ratulstreamhub.vercel.app' }],
  creator: 'Md Ratul Hasan',
  publisher: 'All In One Reborn',
  classification: 'Entertainment, Sports, Streaming Service',
  category: 'Streaming',
  
  // 🔗 এন্টারপ্রাইজ ক্যানোনিকাল ট্যাগ (ডুপ্লিকেট ইউআরএল পেনাল্টি এড়াতে)
  alternates: {
    canonical: 'https://ratulstreamhub.vercel.app',
  },

  // 🤖 অ্যাডভান্সড গুগল বট ডিরেক্টিভস (রিচ স্নিপেট এবং লার্জ ইমেজ প্রিভিউ এনাবল করার জন্য)
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      noimageindex: false,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },

  // 🌐 ওজি মেটা ট্যাগ (সোশ্যাল মিডিয়া ভাইরাল অপ্টিমাইজেশন)
  openGraph: {
    title: 'All In One Reborn | Premium Live Sports & TV',
    description: 'Watch your favorite sports and TV channels live in HD. Get premium access and automated personal M3U playlists instantly.',
    url: 'https://ratulstreamhub.vercel.app',
    siteName: 'All In One Reborn',
    images: [
      {
        url: 'https://placehold.co/1200x630/0f172a/ef4444?text=All+In+One+Reborn+Live+TV', 
        width: 1200,
        height: 630,
        alt: 'All In One Reborn Premium Live TV Hub',
      },
    ],
    locale: 'bn_BD',
    type: 'website',
  },

  // 🐦 টুইটার (X) কার্ড অপ্টিমাইজেশন
  twitter: {
    card: 'summary_large_image',
    title: 'All In One Reborn | Premium Live Sports & TV',
    description: 'Experience premium, ad-free live sports and HD streaming with personal M3U playlists.',
    images: ['https://placehold.co/1200x630/0f172a/ef4444?text=All+In+One+Reborn+Live+TV'],
  },

  // 🛠️ এন্টারপ্রাইজ লেভেল সিকিউরিটি ও ভেরিফিকেশন সার্চ কনসোল ট্যাগ (প্রয়োজনে আপনার কোড বসাতে পারেন)
  verification: {
    google: 'google-site-verification-placeholder', 
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  
  // 🧠 Multi-Schema JSON-LD Structured Data (গুগলকে সাইটের গভীর স্ট্রাকচার বোঝানোর জন্য)
  const enterpriseSchema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebSite',
        '@id': 'https://ratulstreamhub.vercel.app/#website',
        'url': 'https://ratulstreamhub.vercel.app',
        'name': 'All In One Reborn',
        'description': 'Premium Live Sports & TV Streaming Hub',
        'publisher': { '@id': 'https://ratulstreamhub.vercel.app/#organization' },
        'potentialAction': [
          {
            '@type': 'SearchAction',
            'target': 'https://ratulstreamhub.vercel.app/?search={search_term_string}',
            'query-input': 'required name=search_term_string'
          }
        ],
        'inLanguage': 'bn-BD'
      },
      {
        '@type': 'Organization',
        '@id': 'https://ratulstreamhub.vercel.app/#organization',
        'name': 'All In One Reborn',
        'url': 'https://ratulstreamhub.vercel.app',
        'logo': {
          '@type': 'ImageObject',
          'url': 'https://placehold.co/512x512/0f172a/ef4444?text=AIOR',
          'caption': 'All In One Reborn Logo'
        },
        'sameAs': [
          'https://t.me/your_telegram_channel' // আপনার টেলিগ্রাম বা সোশ্যাল লিংক থাকলে এখানে দিতে পারেন
        ]
      }
    ]
  };

  return (
    <html lang="bn" className="antialiased" suppressHydrationWarning>
      <head>
        {/* 🚀 গুগলে সাইটলিংক সার্চবক্স এবং ব্র্যান্ডিং বুস্ট করার জন্য JSON-LD স্কিমা ইনজেকশন */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(enterpriseSchema) }}
        />
      </head>
      <body className={`${inter.className} min-h-screen bg-slate-950 text-white font-sans flex flex-col`}>
        
        <AuthProvider>
          
          {/* আপনার মূল পেজের কন্টেন্ট */}
          {children}

          {/* 🎯 গলোবাল অ্যাড কন্ট্রোলার (লজিক অক্ষত রাখা হলো) */}
          <GlobalAds />
          
        </AuthProvider>

      </body>
    </html>
  );
}
