import { GraduationCap } from 'lucide-react';
import Link from 'next/link';
import { AuthForm } from '@/features/auth/auth-form';
import { ThemeToggle } from '@/components/layout/theme-toggle';

export default function RegisterPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-muted/40 p-4">
      <div className="pointer-events-none absolute inset-0 bg-grid [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,#000_60%,transparent_100%)] opacity-40" />
      <div className="pointer-events-none absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />

      <div className="relative w-full max-w-md animate-[fade-in_0.5s_ease-out_both]">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-indigo-500 text-primary-foreground shadow-lg shadow-primary/25">
            <GraduationCap className="h-6 w-6" />
          </span>
          <div>
            <p className="text-lg font-bold tracking-tight">OES Platform</p>
            <p className="text-sm text-muted-foreground">Create a secure account</p>
          </div>
        </div>

        <AuthForm mode="register" />

        <div className="mt-6 text-center text-xs text-muted-foreground">
          <Link href="/" className="hover:text-foreground hover:underline underline-offset-4">
            ← Back to home
          </Link>
        </div>
      </div>

      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
    </main>
  );
}
