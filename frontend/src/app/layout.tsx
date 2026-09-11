import type { Metadata } from 'next';
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

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth">
      <body className={inter.className}>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
