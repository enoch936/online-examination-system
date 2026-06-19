import { AuthForm } from '@/features/auth/auth-form';

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <AuthForm mode="login" />
    </main>
  );
}
