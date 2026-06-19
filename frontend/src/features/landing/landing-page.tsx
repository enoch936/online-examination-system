'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, BarChart3, BookOpen, GraduationCap, Monitor } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PublicNav } from '@/components/layout/public-nav';
import { Separator } from '@/components/ui/separator';

const features = [
  {
    title: 'Exam authoring',
    description: 'Create secure exams with multi-format questions, randomisation, and timed delivery across departments.',
    icon: BookOpen,
  },
  {
    title: 'Live monitoring',
    description: 'Real-time candidate dashboards with integrity alerts, screen tracking, and automated flagging.',
    icon: Monitor,
  },
  {
    title: 'Grading & reports',
    description: 'Auto-grading with curve adjustments, analytics dashboards, and exportable audit trails.',
    icon: BarChart3,
  },
];

const steps = [
  { number: '01', title: 'Create', description: 'Design exams with varied question types, time limits, and custom rules.' },
  { number: '02', title: 'Deliver', description: 'Distribute securely with identity verification and browser lockdown.' },
  { number: '03', title: 'Monitor', description: 'Track live progress, detect anomalies, and intervene in real time.' },
  { number: '04', title: 'Grade', description: 'Auto-grade submissions, review flagged answers, and publish results.' },
];

export function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <PublicNav />

      <section className="relative overflow-hidden border-b">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,hsl(var(--primary)/0.15),transparent_50%),radial-gradient(circle_at_80%_80%,hsl(var(--accent)/0.1),transparent_50%)]" />
        <div className="container relative z-10 flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center py-20 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <Badge variant="outline" className="mb-6 bg-background/80 px-4 py-1.5 text-sm">
              <GraduationCap className="mr-2 h-3.5 w-3.5" />
              Enterprise examination platform
            </Badge>
            <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              Online Examination System
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
              Securely create, deliver, monitor, grade, and report exams across departments, campuses, and
              certification programs — all from one platform.
            </p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <Button asChild size="lg">
                <Link href="/register">
                  Start securely
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/student/dashboard">View dashboard</Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="border-b py-20">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Everything you need to run exams</h2>
            <p className="mt-4 text-muted-foreground">
              From creation to certification, OES handles the full examination lifecycle.
            </p>
          </div>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <Card key={feature.title} className="border-2 transition-colors hover:border-primary/50">
                  <CardHeader>
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle className="mt-4 text-lg">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm leading-6 text-muted-foreground">{feature.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      <section className="border-b py-20">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">How it works</h2>
            <p className="mt-4 text-muted-foreground">Four steps to exam success.</p>
          </div>
          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step) => (
              <div key={step.number} className="relative">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                  {step.number}
                </div>
                <h3 className="mt-4 font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Ready to get started?</h2>
            <p className="mt-4 text-muted-foreground">
              Join thousands of institutions already using OES.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
              <Button asChild size="lg">
                <Link href="/register">
                  Create your account
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/contact">Talk to sales</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <Separator />

      <footer className="py-8">
        <div className="container flex flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <GraduationCap className="h-4 w-4 text-primary" />
            OES — Online Examination System
          </div>
          <p className="text-xs text-muted-foreground">&copy; {new Date().getFullYear()} OES. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
