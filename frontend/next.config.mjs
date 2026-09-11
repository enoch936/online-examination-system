/** @type {import('next').NextConfig} */

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL ?? apiUrl;
const isDev = process.env.NODE_ENV !== 'production';

function toOrigin(value) {
  try {
    const url = new URL(value);
    return url.origin;
  } catch {
    return '';
  }
}

function toSocketOrigin(value) {
  try {
    const url = new URL(value);
    const protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${url.host}`;
  } catch {
    return '';
  }
}

const connectSrc = [
  "'self'",
  toOrigin(apiUrl),
  toSocketOrigin(apiUrl),
  toOrigin(socketUrl),
  toSocketOrigin(socketUrl),
]
  .filter(Boolean)
  .join(' ');

const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=(), payment=(), usb=()' },
];

// Next.js App Router bootstraps with inline scripts, so 'unsafe-inline' is
// required for script-src unless nonce plumbing is added. This still blocks
// injection of scripts from any external origin while we keep shipping origin
// isolation instead of a fully nonce-based CSP.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src ${connectSrc}`,
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

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
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [{ key: 'Content-Security-Policy', value: csp }, ...securityHeaders],
      },
    ];
  },
};

export default nextConfig;