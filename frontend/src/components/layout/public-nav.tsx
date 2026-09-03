'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { GraduationCap, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { ThemeToggle } from './theme-toggle';
import { Separator } from '@/components/ui/separator';

const links = [
  { href: '#home', label: 'Home' },
  { href: '#features', label: 'Features' },
  { href: '#how-it-works', label: 'How It Works' },
  { href: '#roles', label: 'Roles' },
  { href: '#faq', label: 'FAQ' },
];

const pageLinks = [
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
];

export function PublicNav() {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 w-full transition-all duration-300 ${
        isScrolled
          ? 'border-b border-border/40 bg-background/70 backdrop-blur-xl shadow-lg shadow-black/5 dark:shadow-white/5'
          : 'border-b border-transparent bg-transparent'
      }`}
    >
      <div className="container flex h-16 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2 font-bold text-xl tracking-tight text-foreground">
          <GraduationCap className="h-6 w-6 text-primary" />
          <span className="bg-gradient-to-r from-foreground via-foreground/90 to-primary bg-clip-text text-transparent">
            OES
          </span>
        </Link>

        <nav className="hidden items-center gap-8 text-sm font-medium text-muted-foreground md:flex">
          {[...links, ...pageLinks].map((link) =>
            link.href.startsWith('#') ? (
              <a
                key={link.href}
                href={link.href}
                className="relative transition-colors hover:text-foreground after:absolute after:-bottom-[21px] after:left-0 after:h-[2px] after:w-0 after:bg-primary after:transition-all hover:after:w-full"
              >
                {link.label}
              </a>
            ) : (
              <Link
                key={link.href}
                href={link.href}
                className="relative transition-colors hover:text-foreground after:absolute after:-bottom-[21px] after:left-0 after:h-[2px] after:w-0 after:bg-primary after:transition-all hover:after:w-full"
              >
                {link.label}
              </Link>
            ),
          )}
        </nav>

        <div className="flex items-center gap-3">
          <ThemeToggle />
          
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex hover:bg-muted/80">
            <Link href="/login">Log in</Link>
          </Button>
          
          <Button asChild size="sm" className="hidden sm:inline-flex bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-full shadow-lg shadow-primary/20 transition-all hover:scale-105 active:scale-95">
            <Link href="/register">Get Started</Link>
          </Button>

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden hover:bg-muted/80">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="right"
              data-lenis-prevent
              className="max-h-full w-80 overflow-y-auto overscroll-contain border-l border-border/40 bg-background/95 p-6 backdrop-blur-md"
            >
              <div className="flex flex-col gap-6 pt-6">
                <Link href="/" className="flex items-center gap-2 font-bold text-xl text-foreground">
                  <GraduationCap className="h-6 w-6 text-primary" />
                  OES
                </Link>
                <Separator className="bg-border/40" />
                <nav className="flex flex-col gap-4">
                  {[...links, ...pageLinks].map((link) =>
                    link.href.startsWith('#') ? (
                      <a
                        key={link.href}
                        href={link.href}
                        className="rounded-lg px-3 py-2 text-base font-medium text-muted-foreground transition-all hover:bg-muted hover:text-foreground"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link
                        key={link.href}
                        href={link.href}
                        className="rounded-lg px-3 py-2 text-base font-medium text-muted-foreground transition-all hover:bg-muted hover:text-foreground"
                      >
                        {link.label}
                      </Link>
                    ),
                  )}
                </nav>
                <Separator className="bg-border/40" />
                <div className="flex flex-col gap-3">
                  <Button asChild variant="outline" className="w-full">
                    <Link href="/login">Log in</Link>
                  </Button>
                  <Button asChild className="w-full bg-primary text-primary-foreground shadow-lg shadow-primary/25">
                    <Link href="/register">Get Started</Link>
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
