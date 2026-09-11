/** @type {import('next').NextConfig} */

// Default target for the /api rewrite proxy. NEXT_PUBLIC_API_URL may carry a
// path (e.g. https://host/api/v1); only its origin is used for the proxy so
// /api/:path* maps cleanly onto <origin>/api/v1/:path*.
const apiProxyTarget = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

function toOrigin(value) {
  try {
    return new URL(value).origin;
  } catch {
    return 'http://localhost:4000';
  }
}

const backendOrigin = toOrigin(apiProxyTarget);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typedRoutes: false,
  experimental: {
    optimizePackageImports: ['lucide-react', 'recharts'],
  },
  images: {
    // Disable the built-in image optimizer to remove the open-proxy SSRF
    // surface (_next/image fetching arbitrary hosts). Remote images render
    // directly via the browser; enumerate hosts here if you re-enable it.
    unoptimized: true,
  },
  async rewrites() {
    // Same-origin API proxy so the backend's host-only httpOnly
    // access_token/refresh_token cookies work from this domain.
    return [{ source: '/api/:path*', destination: `${backendOrigin}/api/v1/:path*` }];
  },
  async headers() {
    // CSP is set per-request in middleware.ts (nonce-based). These headers are
    // static and apply to every response.
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=(), payment=(), usb=()' },
        ],
      },
    ];
  },
};

export default nextConfig;