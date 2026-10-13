/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async headers() {
    const noindex = [{ key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' }]
    return [
      { source: '/:path*', has: [{ type: 'host', value: '(www\\.)?alkanka\\.shop' }], headers: noindex },
      { source: '/panel', headers: noindex },
      { source: '/panel/:path*', headers: noindex },
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
    ]
  },
}

export default nextConfig
