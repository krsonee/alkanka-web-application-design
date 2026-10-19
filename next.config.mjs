/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  serverExternalPackages: ['ffmpeg-static'],
  outputFileTracingIncludes: {
    '/api/studio/animate': ['./node_modules/ffmpeg-static/ffmpeg'],
  },
  async redirects() {
    return [
      { source: '/firsatlar', destination: '/ozel-oranlar', permanent: true },
      { source: '/firsatlar/:slug*', destination: '/ozel-oranlar', permanent: true },
    ]
  },
  async headers() {
    const noindex = [{ key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' }]
    const security = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Strict-Transport-Security', value: 'max-age=63072000' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(self), geolocation=()' },
    ]
    const frameGuard = [{ key: 'X-Frame-Options', value: 'SAMEORIGIN' }]
    return [
      { source: '/:path*', headers: security },
      { source: '/panel', headers: frameGuard },
      { source: '/panel/:path*', headers: frameGuard },
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
