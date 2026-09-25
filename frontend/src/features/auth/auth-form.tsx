'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authService } from '@/services/auth.service';
import { useAuthStore } from '@/store/auth.store';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const registerSchema = loginSchema.extend({
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  password: z
    .string()
    .min(12, 'Must be at least 12 characters')
    .regex(/^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[^A-Za-z0-9])/, 'Must include uppercase, lowercase, a number, and a symbol'),
});

type AuthFormProps = {
  mode: 'login' | 'register';
};

type AuthValues = {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
};

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const setSession = useAuthStore((state) => state.setSession);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const schema = mode === 'login' ? loginSchema : registerSchema;
  const form = useForm<AuthValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '', firstName: '', lastName: '' },
  });
  const errors = form.formState.errors;

  const fieldProps = (name: keyof AuthValues) => ({
    'aria-invalid': Boolean(errors[name]),
    'aria-describedby': errors[name] ? `${name}-error` : undefined,
    className: errors[name] ? 'border-destructive focus-visible:ring-destructive' : '',
  });

  function FieldError({ name }: { name: keyof AuthValues }) {
    const message = errors[name]?.message;
    if (!message) return null;
    return (
      <p id={`${name}-error`} className="text-xs text-destructive">
        {message}
      </p>
    );
  }

  async function onSubmit(values: AuthValues) {
    setLoading(true);
    try {
      const result =
        mode === 'login'
          ? await authService.login(values)
          : await authService.register(values as z.infer<typeof registerSchema>);
      setSession(result.accessToken, result.user);
      toast.success(mode === 'login' ? 'Welcome back' : 'Account created');
      const role = result.user.roles[0];
      const dashboard =
        role === 'SUPER_ADMIN' || role === 'ADMIN'
          ? '/admin/dashboard'
          : role === 'INSTRUCTOR'
            ? '/instructor/dashboard'
            : '/student/dashboard';
      router.push(dashboard);
    } catch (err) {
      const message = (err as any)?.response?.data?.message ?? 'Authentication failed';
      toast.error(Array.isArray(message) ? message[0] : message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>{mode === 'login' ? 'Log in' : 'Create account'}</CardTitle>
        <CardDescription>
          {mode === 'login' ? 'Access your examination workspace.' : 'Create a secure student account.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
          {mode === 'register' && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="firstName">First name</Label>
                <Input id="firstName" {...form.register('firstName')} {...fieldProps('firstName')} />
                <FieldError name="firstName" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last name</Label>
                <Input id="lastName" {...form.register('lastName')} {...fieldProps('lastName')} />
                <FieldError name="lastName" />
              </div>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="email" {...form.register('email')} {...fieldProps('email')} />
            <FieldError name="email" />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              {mode === 'login' && (
                <Link href="/forgot-password" className="text-xs text-muted-foreground underline-offset-4 hover:underline">
                  Forgot password?
                </Link>
              )}
            </div>
            <div className="relative">
              <Input id="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" {...form.register('password')} {...fieldProps('password')} />
              <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" tabIndex={-1}>
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <FieldError name="password" />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === 'login' ? 'Log in' : 'Create account'}
          </Button>
        </form>

        <div className="text-center text-sm">
          {mode === 'login' ? (
            <p className="text-muted-foreground">
              Don&apos;t have an account?{' '}
              <Link href="/register" className="font-medium text-primary underline-offset-4 hover:underline">
                Sign up
              </Link>
            </p>
          ) : (
            <p className="text-muted-foreground">
              Already have an account?{' '}
              <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
                Log in
              </Link>
            </p>
          )}
        </div>

      </CardContent>
    </Card>
  );
}
