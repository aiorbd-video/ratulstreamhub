/** @type {import('next').NextConfig} */
const nextConfig = {
  // player_api.php কে আমাদের আসল ফাইলে রুট করার লজিক
  async rewrites() {
    return [
      {
        source: '/player_api.php',
        destination: '/api/xtream',
      },
    ];
  },

  // গ্লোবাল CORS ও সিকিউরিটি বাইপাস রুলস
  async headers() {
    return [
      {
        // API এবং প্লেয়ারের সব রিকোয়েস্টে এই হেডারগুলো বাধ্যতামূলক যাবে
        source: "/:path*",
        headers: [
          { key: "Access-Control-Allow-Credentials", value: "true" },
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,OPTIONS,PATCH,DELETE,POST,PUT" },
          { key: "Access-Control-Allow-Headers", value: "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization" },
        ]
      }
    ];
  }
};

export default nextConfig;
