/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    unoptimized: true,
  },
  serverExternalPackages: ['ffmpeg-static'],
  outputFileTracingIncludes: {
    '/api/studio/animate': ['./node_modules/ffmpeg-static/ffmpeg'],
  },
  // Production only: `pnpm build` runs scripts/make-webp.mjs first, which guarantees
  // every rewrite target exists. In dev, freshly added images may not have a sibling yet.
  async rewrites() {
    if (process.env.NODE_ENV !== 'production') return []
    const acceptsWebp = [{ type: 'header', key: 'accept', value: '.*image/webp.*' }]
    return {
      beforeFiles: ['images', 'postlar'].map((dir) => ({
        source: `/${dir}/:file(.+\\.(?:png|jpe?g|PNG|JPE?G))`,
        has: acceptsWebp,
        destination: `/${dir}/:file.webp`,
      })),
    }
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
    const imageCache = [
      { key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' },
      { key: 'Vary', value: 'Accept' },
    ]
    return [
      { source: '/:path*', headers: security },
      { source: '/images/:path*', headers: imageCache },
      { source: '/postlar/:path*', headers: imageCache },
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
