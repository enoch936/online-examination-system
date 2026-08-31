'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, Loader2, Save } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { authService } from '@/services/auth.service';
import { profileService } from '@/services/profile.service';
import { useAuthStore } from '@/store/auth.store';

const STRONG_PASSWORD_RE = /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[^A-Za-z0-9])/;

export function changePasswordPolicyMessage(password: string): string | null {
  if (password.length < 12) return 'Must be at least 12 characters';
  if (!STRONG_PASSWORD_RE.test(password)) return 'Must include uppercase, lowercase, a number, and a symbol';
  return null;
}

export function ProfileEditor({ role }: { role: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const setSession = useAuthStore((s) => s.setSession);
  const storeUser = useAuthStore((s) => s.user);

  const { data: profile, isLoading } = useQuery({
    queryKey: ['my-profile'],
    queryFn: profileService.getProfile,
  });

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [initialized, setInitialized] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const changePasswordMutation = useMutation({
    mutationFn: authService.changePassword,
    onSuccess: async () => {
      toast.success('Password changed — signing you out. Log in again with your new password.');
      try {
        await authService.logout();
      } catch {
        /* session may already be revoked server-side */
      }
      useAuthStore.getState().clearSession();
      router.push('/login');
    },
    onError: (err: any) => {
      const message = err?.response?.data?.message;
      setPasswordError(Array.isArray(message) ? message[0] : (message ?? 'Failed to change password'));
    },
  });

  if (profile && !initialized) {
    setFirstName(profile.firstName ?? '');
    setLastName(profile.lastName ?? '');
    setEmail(profile.email ?? '');
    setPhone(profile.phone ?? '');
    setInitialized(true);
  }

  const mutation = useMutation({
    mutationFn: profileService.updateProfile,
    onSuccess: (updated) => {
      setSession(useAuthStore.getState().accessToken!, updated);
      queryClient.setQueryData(['my-profile'], updated);
      toast.success('Profile updated');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message ?? 'Failed to update profile');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate({ firstName, lastName, email, phone: phone || undefined });
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');

    if (!currentPassword) {
      setPasswordError('Enter your current password to authorize the change.');
      return;
    }
    const policy = changePasswordPolicyMessage(newPassword);
    if (policy) {
      setPasswordError(policy);
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation do not match.');
      return;
    }
    changePasswordMutation.mutate({ currentPassword, newPassword });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Badge variant="outline">{role}</Badge>
          <h1 className="mt-3 text-3xl font-semibold tracking-normal">Profile</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Manage identity, contact details, and exam profile.</p>
        </div>
        <Card>
          <CardContent className="space-y-4 py-6">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Badge variant="outline">{role}</Badge>
        <h1 className="mt-3 text-3xl font-semibold tracking-normal">Profile</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Manage identity, contact details, and exam profile.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Personal Information</CardTitle>
          <CardDescription>Update your name, email, and contact details.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="firstName">First name</Label>
                <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last name</Label>
                <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone (optional)</Label>
              <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Status:</span>
              <Badge variant="outline">{profile?.status ?? '—'}</Badge>
              {profile?.emailVerifiedAt ? (
                <span className="text-xs text-green-600">Email verified</span>
              ) : (
                <span className="text-xs text-amber-600">Email not verified</span>
              )}
            </div>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Save className="mr-2 h-4 w-4" />
              Save changes
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Account Info</CardTitle>
          <CardDescription>Read-only account metadata.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex justify-between border-b pb-2">
            <span className="text-muted-foreground">User ID</span>
            <span className="font-mono text-xs">{profile?.id}</span>
          </div>
          <div className="flex justify-between border-b pb-2">
            <span className="text-muted-foreground">Roles</span>
            <span>{profile?.roles?.join(', ')}</span>
          </div>
          {profile?.lastLoginAt && (
            <div className="flex justify-between border-b pb-2">
              <span className="text-muted-foreground">Last login</span>
              <span>{new Date(profile.lastLoginAt).toLocaleString()}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Member since</span>
            <span>{profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString() : '-'}</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Change Password</CardTitle>
          <CardDescription>
            Your current password is required. Changing it signs you out of all sessions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current password</Label>
              <Input id="currentPassword" type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">New password</Label>
              <Input id="newPassword" type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
              <p className="text-xs text-muted-foreground">
                At least 12 characters with uppercase, lowercase, a number, and a symbol.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm new password</Label>
              <Input id="confirmPassword" type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            </div>
            {passwordError && <p className="text-sm text-destructive">{passwordError}</p>}
            <Button type="submit" variant="outline" disabled={changePasswordMutation.isPending}>
              {changePasswordMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <KeyRound className="mr-2 h-4 w-4" />
              Change password
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
