import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { Inter } from 'next/font/google';
import '@/styles/globals.css';
import { AppProviders } from '@/providers/app-providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'OES | Enterprise Online Examination System',
  description: 'Secure examination delivery, monitoring, results, and reporting for institutions.',
};

// The nonce CSP (proxy.ts) stamps Next's inline bootstrap scripts with a
// per-request nonce; that only works for dynamically rendered pages, so the
// whole tree must not be statically prerendered.
export const dynamic = 'force-dynamic';

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // proxy.ts generates a per-request nonce and forwards it on the x-nonce
  // request header. Reading it here lets the ThemeProvider stamp next-themes'
  // inline bootstrap script with the same nonce so the strict script-src CSP
  // (no 'unsafe-inline') does not block it.
  const nonce = (await headers()).get('x-nonce') ?? undefined;

  return (
    <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth">
      <body className={inter.className}>
        <AppProviders nonce={nonce}>{children}</AppProviders>
      </body>
    </html>
  );
}
