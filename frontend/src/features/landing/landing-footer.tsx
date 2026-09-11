import Link from 'next/link';
import { GraduationCap } from 'lucide-react';

const columns = [
  {
    heading: 'Product',
    links: [
      { label: 'Exam management', href: '#product' },
      { label: 'Lifecycle', href: '#lifecycle' },
      { label: 'Workspaces', href: '#roles' },
      { label: 'Real-time monitoring', href: '#narrative' },
      { label: 'Architecture', href: '#architecture' },
    ],
  },
  {
    heading: 'Platform',
    links: [
      { label: 'Student dashboard', href: '/login' },
      { label: 'Instructor workspace', href: '/login' },
      { label: 'Admin console', href: '/login' },
      { label: 'Create account', href: '/register' },
    ],
  },
  {
    heading: 'Security',
    links: [
      { label: 'Monitoring & proctoring', href: '#narrative' },
      { label: 'Role-based access', href: '#security' },
      { label: 'Engineered stack', href: '#architecture' },
      { label: 'Fundamentals', href: '#security' },
    ],
  },
  {
    heading: 'Resources',
    links: [
      { label: 'FAQ', href: '/faq' },
      { label: 'About', href: '/about' },
      { label: 'Contact', href: '/contact' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { label: 'About', href: '/about' },
      { label: 'Contact', href: '/contact' },
      { label: 'FAQ', href: '/faq' },
    ],
  },
  {
    heading: 'Legal',
    links: [
      { label: 'Privacy', href: '#' },
      { label: 'Terms', href: '#' },
    ],
  },
];

export function LandingFooter() {
  return (
    <footer className="hairline-top border-t border-border/60 bg-card/20">
      <div className="w-full pb-14">
        <div className="grid gap-10 md:grid-cols-[1.3fr_repeat(6,1fr)]">
          <div className="max-w-xs space-y-4">
            <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight text-foreground">
              <span className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <GraduationCap className="h-4.5 w-4.5" />
              </span>
              <span>OES</span>
            </Link>
            <p className="text-sm leading-relaxed text-muted-foreground">
              A secure online examination platform for students, instructors, administrators, and proctors.
            </p>
          </div>

          {columns.map((col) => (
            <div key={col.heading}>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {col.heading}
              </h4>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((l) =>
                  l.href === '#' ? (
                    <li key={l.label}>
                      <span className="cursor-default text-sm text-muted-foreground/80">{l.label}</span>
                    </li>
                  ) : (
                    <li key={l.label}>
                      <Link
                        href={l.href}
                        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                      >
                        {l.label}
                      </Link>
                    </li>
                  ),
                )}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-border/50 pt-6 sm:flex-row">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} OES Platform. All rights reserved.
          </p>
          <div className="flex gap-5 text-xs text-muted-foreground">
            <Link href="/about" className="transition-colors hover:text-foreground">About</Link>
            <Link href="/faq" className="transition-colors hover:text-foreground">FAQ</Link>
            <Link href="/contact" className="transition-colors hover:text-foreground">Contact</Link>
            <span className="cursor-default text-muted-foreground/80">Privacy</span>
            <span className="cursor-default text-muted-foreground/80">Terms</span>
          </div>
        </div>
      </div>
    </footer>
  );
}