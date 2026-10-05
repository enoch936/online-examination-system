'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation } from '@tanstack/react-query';
import {
  ArrowLeft,
  CheckCircle2,
  Info,
  Loader2,
  Mail,
  MessageSquareText,
  Send,
} from 'lucide-react';
import { PublicNav } from '@/components/layout/public-nav';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { apiErrorMessage } from '@/lib/api-error';
import { contactService } from '@/services/contact.service';
import { useAuthStore } from '@/store/auth.store';

const TEAM_EMAIL = 'tsdat@gmail.com';

const MAX_MESSAGE = 4000;

const items = [
  {
    title: 'Deployment planning',
    content: 'Our team helps you plan cloud or on-premise deployment, including infrastructure sizing, network configuration, and rollout strategy.',
  },
  {
    title: 'Identity integration',
    content: 'Seamless integration with SAML, LDAP, OAuth, and major LMS platforms including Canvas, Blackboard, and Moodle.',
  },
  {
    title: 'Support operations',
    content: 'Enterprise support with dedicated account managers, SLAs, and regular platform health reviews.',
  },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ContactPage() {
  const user = useAuthStore((state) => state.user);
  const [name, setName] = useState(user?.firstName ? `${user.firstName} ${user.lastName ?? ''}`.trim() : '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [message, setMessage] = useState('');
  const [sent, setSent] = useState(false);

  const sendMutation = useMutation({
    mutationFn: () => contactService.send({ name: name.trim(), email: email.trim(), message: message.trim() }),
    onSuccess: () => setSent(true),
  });

  const nameError = name.trim().length === 0 ? 'Tell us who to reply to.' : null;
  const emailError = !email.trim()
    ? 'An email address is required so we can reply.'
    : !EMAIL_RE.test(email.trim())
      ? 'That does not look like a valid email address.'
      : null;
  const messageError = message.trim().length === 0 ? 'Please include a short message.' : null;
  const invalid = Boolean(nameError || emailError || messageError);

  function reset() {
    setSent(false);
    setMessage('');
  }

  return (
    <div className="min-h-screen bg-background">
      <PublicNav />
      <main className="container py-16">
        <Button asChild variant="ghost" size="sm" className="mb-8">
          <Link href="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to home
          </Link>
        </Button>

        <div className="mx-auto max-w-3xl">
          <h1 className="text-4xl font-bold tracking-tight">Contact the tsdat team</h1>
          <p className="mt-4 text-lg leading-8 text-muted-foreground">
            Plan deployment, data migration, identity integration, and proctoring extensions for your
            institution.
          </p>
          <p className="mt-4 inline-flex items-start gap-2 rounded-lg border border-border/60 bg-muted/30 px-4 py-3 text-sm leading-6 text-muted-foreground">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>
              Looking for background on the platform rather than a reply? Read{' '}
              <Link href="/about" className="font-medium text-primary hover:underline">
                About OES
              </Link>{' '}
              instead. Everything sent below is delivered to the administrators&apos; inbox.
            </span>
          </p>
        </div>

        <div className="mx-auto mt-10 grid max-w-5xl gap-6 lg:grid-cols-[1.15fr_1fr] lg:items-start">
          {/* Message form — the reason this page exists */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquareText className="h-5 w-5 text-primary" />
                Send us a message
              </CardTitle>
              <CardDescription>
                Fields marked with <span className="text-destructive">*</span> are required. We reply by email,
                usually within one working day.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {sent ? (
                <div className="space-y-4 py-4 text-center">
                  <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
                  <div>
                    <p className="text-lg font-semibold">Message sent</p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      Thanks — your enquiry is in our administrators&apos; inbox and a copy is on its way to{' '}
                      <span className="font-medium text-foreground">{email.trim()}</span>.
                    </p>
                  </div>
                  <Button variant="outline" onClick={reset}>
                    Send another message
                  </Button>
                </div>
              ) : (
                <form
                  className="space-y-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!invalid) sendMutation.mutate();
                  }}
                  noValidate
                >
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="contact-name">
                        Name <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="contact-name"
                        name="name"
                        autoComplete="name"
                        maxLength={120}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Jane Doe"
                        aria-invalid={Boolean(nameError)}
                        aria-describedby={nameError ? 'contact-name-error' : undefined}
                      />
                      {nameError && (
                        <p id="contact-name-error" className="text-xs text-destructive">
                          {nameError}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="contact-email">
                        Email <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="contact-email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        maxLength={254}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="jane.doe@example.com"
                        aria-invalid={Boolean(emailError)}
                        aria-describedby={emailError ? 'contact-email-error' : undefined}
                      />
                      {emailError && (
                        <p id="contact-email-error" className="text-xs text-destructive">
                          {emailError}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="contact-message">
                        Message <span className="text-destructive">*</span>
                      </Label>
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {message.trim().length}/{MAX_MESSAGE}
                      </span>
                    </div>
                    <Textarea
                      id="contact-message"
                      name="message"
                      rows={7}
                      maxLength={MAX_MESSAGE}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Tell us about your institution, the number of candidates you expect to seat, and any timeline you are working to."
                      aria-invalid={Boolean(messageError)}
                      aria-describedby={messageError ? 'contact-message-error' : undefined}
                      className="min-h-40"
                    />
                    {messageError && (
                      <p id="contact-message-error" className="text-xs text-destructive">
                        {messageError}
                      </p>
                    )}
                  </div>

                  {sendMutation.isError && (
                    <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                      {apiErrorMessage(sendMutation.error, 'We could not send your message. Please try again.')}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-3">
                    <Button type="submit" disabled={invalid || sendMutation.isPending}>
                      {sendMutation.isPending ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="mr-2 h-4 w-4" />
                      )}
                      {sendMutation.isPending ? 'Sending…' : 'Send message'}
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      Goes straight to the OES administrators&apos; inbox.
                    </p>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>

          {/* Direct channels + the original context cards */}
          <div className="space-y-6">
            <Card className="flex flex-col gap-4 border-border/60 bg-card/60 p-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/12 text-primary">
                  <Mail className="h-6 w-6" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-foreground">Email the tsdat team</p>
                  <a
                    href={`mailto:${TEAM_EMAIL}`}
                    className="text-base font-medium text-primary hover:underline"
                  >
                    {TEAM_EMAIL}
                  </a>
                </div>
              </div>
              <Button asChild size="sm" className="shrink-0 bg-primary hover:bg-primary/90">
                <a href={`mailto:${TEAM_EMAIL}`}>
                  <MessageSquareText className="mr-2 h-4 w-4" />
                  Send a message
                </a>
              </Button>
            </Card>

            <div className="grid gap-6 sm:grid-cols-1">
              {items.map((item) => (
                <Card key={item.title} className="flex flex-col">
                  <CardHeader>
                    <CardTitle className="text-lg">{item.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="flex-1">
                    <p className="text-sm leading-6 text-muted-foreground">{item.content}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </main>
      <Separator />
      <footer className="py-8">
        <div className="container flex flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="font-semibold">OES</span> — Online Examination System
          </div>
          <p className="text-xs text-muted-foreground">&copy; {new Date().getFullYear()} OES. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
