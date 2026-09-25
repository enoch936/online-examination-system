import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Edge-compatible CSP nonce (Web Crypto available in both Node and Edge runtimes).
function randomNonce(): string {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().replace(/-/g, '');
  }
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

const publicPaths = ['/', '/login', '/register', '/forgot-password', '/reset-password', '/verify-email'];

function toOrigin(value: string | undefined): string {
  if (!value) return '';
  try {
    return new URL(value).origin;
  } catch {
    return '';
  }
}

function toSocketOrigin(value: string | undefined): string {
  if (!value) return '';
  try {
    const url = new URL(value);
    const protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${url.host}`;
  } catch {
    return '';
  }
}

const isDev = process.env.NODE_ENV !== 'production';

// Socket origins are still direct (not proxied), so the CSP must allowlist them.
const socketOrigins = [
  toOrigin(process.env.NEXT_PUBLIC_API_URL),
  toSocketOrigin(process.env.NEXT_PUBLIC_API_URL),
  toOrigin(process.env.NEXT_PUBLIC_SOCKET_URL),
  toSocketOrigin(process.env.NEXT_PUBLIC_SOCKET_URL),
]
  .filter(Boolean)
  .join(' ');

const turnstileSrc = 'https://challenges.cloudflare.com';

// Proctoring is a real feature: the exam-taking flow under /student/exams/
// (take/resume pages) uses the webcam + microphone for face/audio monitoring.
// Permissions-Policy cannot restrict camera/mic by URL path inside the header
// value, so the header is emitted per-route here: globally denied, allowed only
// on the proctoring route prefix. proctoring the whole route group is fine
// because the camera never runs outside of the exam flow.
function permissionsPolicyHeader(pathname: string): string {
  const proctoringAllowed = pathname.startsWith('/student/exams/');
  return proctoringAllowed
    ? 'camera=(self), microphone=(self), geolocation=(), payment=(), usb=()'
    : 'camera=(), microphone=(), geolocation=(), payment=(), usb=()';
}

// Next.js injects an inline bootstrap script per request; the per-request nonce
// in the x-nonce header is auto-applied by Next to its own inline scripts, so no
// 'unsafe-inline'/'unsafe-eval' is needed in production. style-src keeps
// 'unsafe-inline' because Next inlines some styles on initial paint.
function buildCsp(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' ${turnstileSrc}${isDev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src 'self' ${socketOrigins} ${turnstileSrc}`.trim(),
    "media-src 'self' blob:",
    "worker-src 'self' blob:",
    `frame-src ${turnstileSrc}`,
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
}

/**
 * Decode the JWT `exp` claim without signature verification. Used solely to
 * avoid serving authenticated pages to clearly-expired sessions; the backend
 * still verifies signature + account state, so this is defense-in-depth, never
 * an authorization boundary.
 */
function isExpiredToken(token: string): boolean {
  const [, payload] = token.split('.');
  if (!payload) return true;
  try {
    let base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4 !== 0) base64 += '=';
    const json = JSON.parse(atob(base64));
    return typeof json.exp !== 'number' || json.exp * 1000 <= Date.now();
  } catch {
    return true;
  }
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // "/" must match exactly — startsWith("/") is true for EVERY path, which
  // previously made every route public and silently disabled the redirect gate.
  const isPublic =
    pathname === '/sw.js' || publicPaths.some((p) => (p === '/' ? pathname === '/' : pathname.startsWith(p)));

  // httpOnly cookies set by the backend (readable server-side). Access token
  // validates freshness; a present refresh token lets the client restore the
  // session at boot even if the access token just expired.
  const accessToken = request.cookies.get('access_token')?.value;
  const refreshToken = request.cookies.get('refresh_token')?.value;
  const hasLiveAccess = Boolean(accessToken && !isExpiredToken(accessToken));
  const canRestore = Boolean(refreshToken);

  if (!isPublic && !hasLiveAccess && !canRestore) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    const response = NextResponse.redirect(loginUrl);
    response.headers.set('Content-Security-Policy', buildCsp(randomNonce()));
    response.headers.set('Permissions-Policy', permissionsPolicyHeader(pathname));
    return response;
  }

  // Nonce + CSP must be applied to every rendered response (Next.js reads the
  // x-nonce request header and stamps its inline bootstrap scripts with it).
  const nonce = randomNonce();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', buildCsp(nonce));
  response.headers.set('Permissions-Policy', permissionsPolicyHeader(pathname));
  return response;
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|\\.well-known|sw.js).*)',
  ],
};