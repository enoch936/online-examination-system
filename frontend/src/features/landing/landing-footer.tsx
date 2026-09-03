import Link from 'next/link';
import { GraduationCap } from 'lucide-react';

const columns = [
  {
    heading: 'Product',
    links: [
      { label: 'Exam management', href: '#product' },
      { label: 'Lifecycle', href: '#lifecycle' },
      { label: 'Roles', href: '#roles' },
      { label: 'Security', href: '#security' },
    ],
  },
  {
    heading: 'Resources',
    links: [
      { label: 'About', href: '/about' },
      { label: 'tsdat', href: '/contact' },
    ],
  },
  {
    heading: 'Account',
    links: [
      { label: 'Log in', href: '/login' },
      { label: 'Create account', href: '/register' },
      { label: 'Student dashboard', href: '/login' },
    ],
  },
];

export function LandingFooter() {
  return (
    <footer className="border-t border-border/60 bg-card/20">
      <div className="mx-auto max-w-6xl px-5 py-14 sm:px-6">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div className="max-w-xs space-y-4">
            <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight text-foreground">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <GraduationCap className="h-4.5 w-4.5" />
              </span>
              OES
            </Link>
            <p className="text-sm leading-relaxed text-muted-foreground">
              A secure online examination platform for students, instructors, and administrators.
            </p>
          </div>

          {columns.map((col) => (
            <div key={col.heading}>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {col.heading}
              </h4>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link
                      href={l.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-border/50 pt-6 sm:flex-row">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} OES Platform. All rights reserved.
          </p>
          <div className="flex gap-5 text-xs text-muted-foreground">
            <Link href="/contact" className="transition-colors hover:text-foreground">Contact</Link>
            <span className="cursor-pointer transition-colors hover:text-foreground">Privacy</span>
            <span className="cursor-pointer transition-colors hover:text-foreground">Terms</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
