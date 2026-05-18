/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/player_api.php',
        destination: '/api/xtream',
      },
      {
        // 🎯 ম্যাজিক: যদি অ্যাপ /live ছাড়া ডিরেক্ট লিংক পাঠায় (Smarters Pro এর ডিফল্ট রিকোয়েস্ট)
        source: '/:username([0-9]{10,15})/:password/:stream_id',
        destination: '/api/play_xtream?username=:username&password=:password&stream_id=:stream_id',
      },
      {
        // 🎯 ম্যাজিক: যদি অ্যাপ /live যুক্ত করে লিংক পাঠায় (TiviMate এর রিকোয়েস্ট)
        source: '/live/:username/:password/:stream_id',
        destination: '/api/play_xtream?username=:username&password=:password&stream_id=:stream_id',
      }
    ];
  },
};

export default nextConfig;
