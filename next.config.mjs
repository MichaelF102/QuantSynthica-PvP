/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Market data files are static but can be refreshed by a redeploy, so caches revalidate hourly
  // instead of keeping them forever. Applies on Vercel and on `next start` (Render) alike.
  async headers() {
    return [
      {
        source: '/data/:file*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=3600, stale-while-revalidate=86400' }],
      },
    ];
  },
};

export default nextConfig;
