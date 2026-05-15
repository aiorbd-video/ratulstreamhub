// ফাইল পাথ: next.config.ts (বা next.config.js)
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**", // যেকোনো ডোমেইন থেকে ছবি অ্যালাও করবে
      },
      {
        protocol: "http",
        hostname: "**", // HTTP ডোমেইনগুলোও অ্যালাও করবে
      },
    ],
  },
};

export default nextConfig;
