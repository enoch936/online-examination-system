'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { GraduationCap, Menu, X, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/layout/theme-toggle';

const links = [
  { href: '#product', label: 'Product' },
  { href: '#lifecycle', label: 'Lifecycle' },
  { href: '#roles', label: 'Roles' },
  { href: '#security', label: 'Security' },
];

export function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion() ?? false;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-5 sm:pt-4">
      <motion.nav
        initial={reduce ? false : { y: -24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className={cn(
          'mx-auto flex max-w-6xl items-center justify-between gap-4 rounded-2xl border px-4 py-2.5 transition-all duration-300',
          scrolled
            ? 'border-border/60 bg-background/70 shadow-lg shadow-black/5 backdrop-blur-xl dark:shadow-white/5'
            : 'border-transparent bg-transparent',
        )}
      >
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight text-foreground">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm shadow-primary/30">
            <GraduationCap className="h-4.5 w-4.5" />
          </span>
          <span>OES</span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="rounded-lg px-3 py-2 text-[0.85rem] font-medium text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
            >
              {l.label}
            </a>
          ))}
          <Link
            href="/contact"
            className="rounded-lg px-3 py-2 text-[0.85rem] font-medium text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
          >
            tsdat
          </Link>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link
            href="/login"
            className="hidden rounded-lg px-3 py-2 text-[0.85rem] font-medium text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground sm:block"
          >
            Log in
          </Link>
          <Link
            href="/register"
            className="group hidden items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-[0.85rem] font-semibold text-primary-foreground shadow-sm shadow-primary/30 transition-all hover:bg-primary/90 sm:inline-flex"
          >
            Get started
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>

          <button
            aria-label="Open menu"
            onClick={() => setOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-white/5 md:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </motion.nav>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[60] bg-background/40 backdrop-blur-sm md:hidden"
            onClick={() => setOpen(false)}
          >
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'tween', duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="absolute right-0 top-0 flex h-full w-[78vw] max-w-sm flex-col gap-6 border-l border-border/60 bg-background p-6 pt-5"
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 font-semibold text-foreground">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                    <GraduationCap className="h-4.5 w-4.5" />
                  </span>
                  OES
                </span>
                <button
                  aria-label="Close menu"
                  onClick={() => setOpen(false)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-white/5"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <nav className="flex flex-col gap-1">
                {[...links, { href: '/contact', label: 'tsdat' }].map((l, i) => (
                  <a
                    key={l.href}
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className="rounded-lg px-3 py-3 text-base font-medium text-foreground transition-colors hover:bg-white/5"
                  >
                    {l.label}
                  </a>
                ))}
              </nav>

              <div className="mt-auto flex flex-col gap-2.5">
                <Link
                  href="/login"
                  onClick={() => setOpen(false)}
                  className="rounded-xl border border-border px-4 py-3 text-center text-sm font-semibold text-foreground transition-colors hover:bg-white/5"
                >
                  Log in
                </Link>
                <Link
                  href="/register"
                  onClick={() => setOpen(false)}
                  className="rounded-xl bg-primary px-4 py-3 text-center text-sm font-semibold text-primary-foreground shadow-sm shadow-primary/30"
                >
                  Get started
                </Link>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
