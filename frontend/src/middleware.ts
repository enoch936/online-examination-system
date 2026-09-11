import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const publicPaths = ['/', '/login', '/register', '/forgot-password', '/reset-password', '/verify-email'];

/**
 * Decode the JWT `exp` claim without signature verification. Used solely to
 * avoid serving authenticated pages (and their markup) to clearly-expired
 * sessions; the backend still verifies signature + account state, so this is
 * defense-in-depth, never an authorization boundary.
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

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === '/sw.js' || publicPaths.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const token = request.cookies.get('oes-auth-token')?.value;
  if (!token || isExpiredToken(token)) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
};