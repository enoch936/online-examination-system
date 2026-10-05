'use client';

import Link from 'next/link';
import {
  Activity,
  Award,
  ArrowRight,
  BarChart3,
  BookOpen,
  CheckCircle2,
  FileCheck,
  Globe,
  LockKeyhole,
  Mail,
  PenLine,
  Radio,
  ScrollText,
  Server,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { PublicNav } from '@/components/layout/public-nav';
import { Button } from '@/components/ui/button';
import { Counter, Reveal, SectionHeader } from './landing-primitives';
import { cn } from '@/lib/utils';

/**
 * About OES — the "what is this and who is it for" page.
 *
 * Deliberately distinct from /contact: this page only ever describes the
 * platform. Anything that wants a human to respond routes to /contact, and the
 * closing CTA points there.
 */

const capabilities = [
  {
    icon: PenLine,
    title: 'Authoring',
    body: 'Build question banks with reusable items, tags and difficulty weighting, then assemble exams from them. Blueprint-style weighting keeps every paper comparable.',
  },
  {
    icon: Globe,
    title: 'Delivery',
    body: 'Scheduled and on-demand exams, randomised question order per candidate, autosave on every answer, and resumable sessions that survive a dropped connection.',
  },
  {
    icon: Radio,
    title: 'Live proctoring',
    body: 'A proctor watches an exam in real time over WebSocket: candidate webcam, screen and focus-change events streamed live with flags raised the moment something looks wrong.',
  },
  {
    icon: FileCheck,
    title: 'Grading',
    body: 'Objective items are scored on submit. Subjective work queues for manual review, so nothing is finalised before a human has seen it.',
  },
  {
    icon: BarChart3,
    title: 'Reporting',
    body: 'Cohort performance, item analysis and per-student breakdowns, exportable for departmental review without touching the database.',
  },
  {
    icon: Award,
    title: 'Certificates',
    body: 'Issued from a verified snapshot of the result at the moment of issue, so a later grade correction can never retroactively change a certificate.',
  },
];

const lifecycle = [
  { step: '01', title: 'Author', body: 'Instructors draft questions and assemble a paper against a blueprint.' },
  { step: '02', title: 'Schedule', body: 'Admins set windows, cohorts and rules for a sitting.' },
  { step: '03', title: 'Deliver', body: 'Candidates are admitted, verified and seated into an exam session.' },
  { step: '04', title: 'Monitor', body: 'Proctors observe live integrity signals and raise flags in real time.' },
  { step: '05', title: 'Grade', body: 'Automatic scoring plus manual review for subjective answers.' },
  { step: '06', title: 'Certify', body: 'Results are published and certificates are issued and verifiable.' },
];

const workspaces = [
  { role: 'Super admin', body: 'Owns the platform: roles, permissions, subjects, courses and every policy that spans departments.' },
  { role: 'Admin', body: 'Runs academic operations — users, classes, exam scheduling, published results and certificates.' },
  { role: 'Instructor', body: 'Authors questions, builds and delivers exams, grades submissions and monitors their own sessions.' },
  { role: 'Proctor', body: 'Watches live sessions, reviews flags and intervenes while an exam is still running.' },
  { role: 'Student', body: 'Takes exams, resumes interrupted attempts and collects results and certificates.' },
];

const principles = [
  {
    icon: LockKeyhole,
    title: 'Least privilege by default',
    body: 'Access is granted per role and checked on every request, not just hidden in the interface. A suspended or demoted account loses access on the next call.',
  },
  {
    icon: Activity,
    title: 'Integrity signals, not accusations',
    body: 'Focus changes, tab switches and webcam frames are recorded as evidence for a human to judge. The platform flags; it does not convict.',
  },
  {
    icon: ScrollText,
    title: 'An audit trail you can defend',
    body: 'Privileged actions are recorded with actor, target and timestamp, so a disputed grade can be reconstructed after the fact.',
  },
  {
    icon: Server,
    title: 'Built to run where you need it',
    body: 'A standard REST and WebSocket service over PostgreSQL — deployable to a managed cloud or on-premise behind your own network.',
  },
];

const facts = [
  { value: 5, suffix: '', label: 'Role-scoped workspaces' },
  { value: 6, suffix: '', label: 'Stages in an exam lifecycle' },
  { value: 100, suffix: '%', label: 'Privileged actions audited' },
  { value: 24, suffix: '/7', label: 'Live monitoring availability' },
];

export function AboutPage() {
  return (
    <div className="relative min-h-screen overflow-x-clip bg-background text-foreground selection:bg-primary/30">
      <PublicNav />

      <main>
        {/* ---------------------------------------------------------- */}
        {/* Masthead                                                     */}
        {/* ---------------------------------------------------------- */}
        <section className="relative overflow-hidden pt-32 pb-20 sm:pt-40 sm:pb-24">
          <div className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute left-1/2 top-0 h-[36rem] w-[36rem] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
            <div className="absolute right-[-10%] top-40 h-72 w-72 rounded-full bg-gold/10 blur-3xl" />
          </div>

          <div className="landing-container max-w-3xl text-center">
            <Reveal>
              <span className="eyebrow">
                <span className="eyebrow-dot-gold" />
                About OES
              </span>
            </Reveal>

            <Reveal delay={0.05}>
              <h1 className="mt-6 text-[2.2rem] font-semibold leading-[1.08] tracking-[-0.03em] sm:text-[3rem]">
                Built for academic operations,
                <span className="block text-gold-gradient">not just online quizzes.</span>
              </h1>
            </Reveal>

            <Reveal delay={0.12}>
              <p className="mx-auto mt-6 max-w-2xl text-[0.98rem] leading-relaxed text-muted-foreground">
                OES is an examination platform for institutions that have to defend their results. It covers the
                whole path — authoring, delivery, live proctoring, grading, reporting and certification — with
                role-scoped workspaces and an audit trail over every privileged action.
              </p>
            </Reveal>

            <Reveal delay={0.18}>
              <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
                <Link
                  href="/register"
                  className="btn-shine group inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:bg-primary/90"
                >
                  Get started
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
                <Link
                  href="/contact"
                  className="group inline-flex items-center gap-2 rounded-xl border border-border bg-card/40 px-6 py-3 text-sm font-semibold text-foreground backdrop-blur-md transition-colors hover:bg-card/70"
                >
                  <Mail className="h-4 w-4" />
                  Talk to our team
                </Link>
              </div>
            </Reveal>
          </div>
        </section>

        {/* ---------------------------------------------------------- */}
        {/* What the platform covers                                    */}
        {/* ---------------------------------------------------------- */}
        <section className="py-20 sm:py-24">
          <div className="landing-container">
            <SectionHeader
              eyebrow="What the platform covers"
              title="Six capabilities, one exam"
              sub="Each stage below is a first-class part of the system rather than an integration bolted on afterwards."
            />

            <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {capabilities.map((item, i) => (
                <Reveal key={item.title} delay={i * 0.06}>
                  <div className="group h-full rounded-2xl border border-border/60 bg-card/40 p-6 backdrop-blur-md transition-colors hover:border-primary/40 hover:bg-card/70">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/12 text-primary transition-transform duration-300 group-hover:scale-105">
                      <item.icon className="h-5 w-5" />
                    </span>
                    <h3 className="mt-4 text-base font-semibold">{item.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.body}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------- */}
        {/* Lifecycle                                                   */}
        {/* ---------------------------------------------------------- */}
        <section className="border-y border-border/40 bg-muted/20 py-20 sm:py-24">
          <div className="landing-container">
            <SectionHeader
              eyebrow="Exam lifecycle"
              title="From question to certificate"
              sub="Nothing falls between the stages — each hand-off is recorded, and the result carries its own provenance."
            />

            <ol className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {lifecycle.map((item, i) => (
                <Reveal key={item.step} delay={i * 0.05}>
                  <li className="relative h-full rounded-2xl border border-border/60 bg-background/60 p-6">
                    <span className="font-mono text-xs font-semibold text-gold-strong">{item.step}</span>
                    <h3 className="mt-3 text-base font-semibold">{item.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.body}</p>
                  </li>
                </Reveal>
              ))}
            </ol>
          </div>
        </section>

        {/* ---------------------------------------------------------- */}
        {/* Workspaces                                                  */}
        {/* ---------------------------------------------------------- */}
        <section className="py-20 sm:py-24">
          <div className="landing-container grid gap-12 lg:grid-cols-[1fr_1.1fr] lg:items-center">
            <div>
              <SectionHeader
                eyebrow="Who it's for"
                title="One platform, five workspaces"
                sub="Each role gets its own dashboard and its own permission set. Nobody sees controls they cannot use, and nobody can use controls they cannot see."
                align="left"
              />
              <Reveal delay={0.1}>
                <div className="mt-8 flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 px-3 py-1.5">
                    <Users className="h-3.5 w-3.5 text-primary" />
                    Per-role dashboards
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 px-3 py-1.5">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                    Server-enforced permissions
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 px-3 py-1.5">
                    <BookOpen className="h-3.5 w-3.5 text-gold-strong" />
                    Question banks
                  </span>
                </div>
              </Reveal>
            </div>

            <div className="space-y-3">
              {workspaces.map((item, i) => (
                <Reveal key={item.role} delay={i * 0.06}>
                  <div className="rounded-xl border border-border/60 bg-card/40 p-5 backdrop-blur-md">
                    <p className="text-sm font-semibold">{item.role}</p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.body}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------- */}
        {/* Principles                                                  */}
        {/* ---------------------------------------------------------- */}
        <section className="border-y border-border/40 bg-muted/20 py-20 sm:py-24">
          <div className="landing-container">
            <SectionHeader
              eyebrow="How we build it"
              title="Integrity without hand-waving"
              sub="Four commitments that shape the architecture rather than the marketing copy."
            />

            <div className="mt-14 grid gap-5 sm:grid-cols-2">
              {principles.map((item, i) => (
                <Reveal key={item.title} delay={i * 0.06}>
                  <div className="flex h-full gap-4 rounded-2xl border border-border/60 bg-background/60 p-6">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary">
                      <item.icon className="h-5 w-5" />
                    </span>
                    <div>
                      <h3 className="text-base font-semibold">{item.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.body}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------- */}
        {/* Facts                                                       */}
        {/* ---------------------------------------------------------- */}
        <section className="py-20 sm:py-24">
          <div className="landing-container">
            <div className="grid gap-6 rounded-2xl border border-border/60 bg-card/30 p-8 sm:grid-cols-2 lg:grid-cols-4">
              {facts.map((fact, i) => (
                <Reveal key={fact.label} delay={i * 0.06}>
                  <div className="text-center">
                    <p className="text-3xl font-semibold tracking-tight text-foreground">
                      <Counter value={fact.value} suffix={fact.suffix} />
                    </p>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">{fact.label}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------- */}
        {/* Closing CTA — the only route to a human is /contact        */}
        {/* ---------------------------------------------------------- */}
        <section className="pb-28 sm:pb-32">
          <div className="landing-container">
            <Reveal>
              <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-card/40 p-10 text-center backdrop-blur-md sm:p-14">
                <div className="pointer-events-none absolute inset-0 -z-10">
                  <div className="absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-3xl" />
                </div>
                <span className="eyebrow">
                  <span className="eyebrow-dot-gold" />
                  Questions
                </span>
                <h2 className="mt-5 text-[1.7rem] font-semibold tracking-tight sm:text-3xl">
                  Want this running at your institution?
                </h2>
                <p className="mx-auto mt-4 max-w-xl text-[0.95rem] leading-relaxed text-muted-foreground">
                  Deployment planning, data migration and identity integration are all handled by the same team
                  that builds the platform.
                </p>
                <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                  <Link
                    href="/contact"
                    className="btn-shine group inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:bg-primary/90"
                  >
                    Contact the team
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                  <Link
                    href="/"
                    className={cn(
                      'inline-flex items-center gap-2 rounded-xl border border-border bg-background/40 px-6 py-3',
                      'text-sm font-semibold text-foreground transition-colors hover:bg-card/70',
                    )}
                  >
                    Back to overview
                  </Link>
                </div>
                <p className="mt-6 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  Every enquiry reaches an administrator inbox — nothing is dropped into a black hole.
                </p>
              </div>
            </Reveal>
          </div>
        </section>
      </main>
    </div>
  );
}
