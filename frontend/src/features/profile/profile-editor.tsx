'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Save } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { profileService } from '@/services/profile.service';
import { useAuthStore } from '@/store/auth.store';

export function ProfileEditor({ role }: { role: string }) {
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
    </div>
  );
}
