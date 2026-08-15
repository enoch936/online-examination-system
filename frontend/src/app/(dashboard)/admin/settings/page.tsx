'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Sun, Moon, Save, Loader2, User, Settings2 } from 'lucide-react';
import { toast } from 'sonner';
import { profileService } from '@/services/profile.service';
import { settingsService } from '@/services/settings.service';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';

export default function AdminSettingsPage() {
  const queryClient = useQueryClient();
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '' });

  useEffect(() => {
    const root = document.documentElement;
    const stored = localStorage.getItem('theme') as 'light' | 'dark' | null;
    const preferred = stored || (window.matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light');
    setTheme(preferred);
    root.classList.toggle('dark', preferred === 'dark');
  }, []);

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    document.documentElement.classList.toggle('dark', next === 'dark');
    localStorage.setItem('theme', next);
  };

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const p = await profileService.getProfile();
      setForm({ firstName: p.firstName, lastName: p.lastName, email: p.email, phone: p.phone || '' });
      return p;
    },
  });

  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ['settings', 'public'],
    queryFn: settingsService.getPublic,
  });

  const updateMutation = useMutation({
    mutationFn: () => profileService.updateProfile(form),
    onSuccess: () => {
      toast.success('Profile updated');
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
    onError: () => toast.error('Failed to update profile'),
  });

  return (
    <div className="space-y-6">
      <div>
        <Badge variant="outline" className="border-indigo-500/30 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">Admin</Badge>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">System settings</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Configure platform policies and institution defaults.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings2 className="h-4 w-4" /> Platform config
            </CardTitle>
            <CardDescription>Read-only system configuration.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">API URL</span>
              <span className="font-mono text-xs">{process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Environment</span>
              {settingsLoading ? (
                <Skeleton className="h-4 w-20" />
              ) : (
                <Badge variant="outline">{settings?.environment ?? '—'}</Badge>
              )}
            </div>
            <Separator />
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">JWT expiry</span>
              <span className="font-mono text-xs">{settingsLoading ? <Skeleton className="h-4 w-16" /> : (settings?.jwtAccessExpiry ?? '—')}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Refresh token expiry</span>
              <span className="font-mono text-xs">{settingsLoading ? <Skeleton className="h-4 w-16" /> : (settings?.jwtRefreshExpiry ?? '—')}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Rate limit (RPM)</span>
              <span className="font-mono text-xs">{settingsLoading ? <Skeleton className="h-4 w-16" /> : (settings?.rateLimit ?? '—')}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sun className="h-4 w-4" /> Appearance
            </CardTitle>
            <CardDescription>Toggle between light and dark mode.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Button variant="outline" onClick={toggleTheme} className="gap-2">
                {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                Switch to {theme === 'light' ? 'dark' : 'light'} mode
              </Button>
              <span className="text-sm capitalize text-muted-foreground">Current: {theme}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-4 w-4" /> Profile
          </CardTitle>
          <CardDescription>Update your profile information.</CardDescription>
        </CardHeader>
        <CardContent>
          {profileLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="sfn">First name</Label>
                <Input id="sfn" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="sln">Last name</Label>
                <Input id="sln" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="sem">Email</Label>
                <Input id="sem" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="sph">Phone</Label>
                <Input id="sph" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
            </div>
          )}
          <div className="mt-4">
            <Button disabled={updateMutation.isPending} onClick={() => updateMutation.mutate()}>
              {updateMutation.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              <Save className="mr-1 h-4 w-4" /> Save changes
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
