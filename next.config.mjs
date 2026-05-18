/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/player_api.php',
        destination: '/api/xtream',
      },
    ];
  },
};

export default nextConfig;
