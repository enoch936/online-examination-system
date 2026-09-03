'use client';

import { useRef, useState } from 'react';
import {
  motion,
  useScroll,
  useMotionValueEvent,
  useReducedMotion,
} from 'framer-motion';
import { Reveal, WrapUpText } from './landing-primitives';
import { Webcam, Shield } from './landing-objects';
import { cn } from '@/lib/utils';

const EASE = [0.16, 1, 0.3, 1] as const;

/* ------------------------------------------------------------------ */
/* Sticky scroll narrative — pivots through each role's interface.     */
/* Blur -> transform -> sharp as scroll progress advances a step.     */
/* ------------------------------------------------------------------ */

type Step = { id: string; title: string; body: string; ui: React.ReactNode };

function StudentPanel() {
  return (
    <div className="space-y-3 p-5">
      <div className="flex items-center justify-between">
        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[0.65rem] font-semibold text-primary">
          CS302 · Data Systems
        </span>
        <span className="flex items-center gap-1 font-mono text-xs text-amber-500">24:18</span>
      </div>
      <p className="text-sm font-medium text-foreground">“Which constraint ensures column values are unique?”</p>
      <div className="grid grid-cols-2 gap-2">
        {['PRIMARY KEY', 'UNIQUE', 'FOREIGN KEY', 'CHECK'].map((o, i) => (
          <div
            key={o}
            className={cn(
              'rounded-lg border px-3 py-2 text-xs font-medium',
              i === 1 ? 'border-primary/40 bg-primary/10 text-foreground' : 'border-border/50 bg-card/40 text-muted-foreground',
            )}
          >
            {o}
          </div>
        ))}
      </div>
      <div className="flex gap-1.5 pt-1">
        {Array.from({ length: 8 }).map((_, i) => (
          <span key={i} className={cn('h-1.5 flex-1 rounded-full', i < 4 ? 'bg-primary' : 'bg-border/70')} />
        ))}
      </div>
    </div>
  );
}

function InstructorPanel() {
  const rows = [
    { q: 'PostgreSQL default port', tag: '1 pt', c: 'text-emerald-500' },
    { q: 'Explain 3NF requirements', tag: '4 pts', c: 'text-amber-500' },
    { q: 'Write a nested join query', tag: '5 pts', c: 'text-rose-500' },
  ];
  return (
    <div className="space-y-3 p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">Question bank</span>
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[0.65rem] font-medium text-primary">32 items</span>
      </div>
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.q} className="flex items-center justify-between rounded-lg border border-border/50 bg-card/40 px-3 py-2 text-xs">
            <span className="text-muted-foreground">{r.q}</span>
            <span className={cn('font-medium', r.c)}>{r.tag}</span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2 text-center">
        <div className="rounded-lg bg-background/50 px-2 py-2">
          <p className="text-base font-semibold text-foreground">18</p>
          <p className="text-[0.6rem] uppercase tracking-wide text-muted-foreground">Published</p>
        </div>
        <div className="rounded-lg bg-background/50 px-2 py-2">
          <p className="text-base font-semibold text-foreground">6</p>
          <p className="text-[0.6rem] uppercase tracking-wide text-muted-foreground">Awaiting</p>
        </div>
      </div>
    </div>
  );
}

function AdminPanel() {
  return (
    <div className="space-y-3 p-5">
      <div className="grid grid-cols-2 gap-2 text-center">
        <div className="rounded-lg bg-background/50 px-2 py-2">
          <p className="text-base font-semibold text-foreground">2,483</p>
          <p className="text-[0.6rem] uppercase tracking-wide text-muted-foreground">Users</p>
        </div>
        <div className="rounded-lg bg-background/50 px-2 py-2">
          <p className="text-base font-semibold text-foreground">12%</p>
          <p className="text-[0.6rem] uppercase tracking-wide text-muted-foreground">Load</p>
        </div>
      </div>
      <div className="rounded-lg border border-border/50 bg-card/40 p-3">
        <p className="mb-2 text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">Audit trail</p>
        {['Exam CS302 published', 'Student cs-290 submitted'].map((l) => (
          <p key={l} className="font-mono text-[0.65rem] text-muted-foreground">· {l}</p>
        ))}
      </div>
    </div>
  );
}

function ProctorPanel() {
  return (
    <div className="space-y-3 p-5">
      <div className="flex items-center gap-3">
        <Webcam className="h-12 w-16 shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-medium text-foreground">Candidate cs-290</p>
          <p className="text-xs text-emerald-500">Identity verified</p>
        </div>
        <Shield className="h-8 w-7 shrink-0" />
      </div>
      <div className="space-y-1.5">
        {[
          ['Fullscreen', 'Active', 'text-emerald-500'],
          ['Tab switching', 'Flagged', 'text-amber-500'],
          ['Webcam', 'Live', 'text-emerald-500'],
        ].map(([k, v, c]) => (
          <div key={k as string} className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{k}</span>
            <span className={cn('font-medium', c)}>{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AnalyticsPanel() {
  const bars = [34, 52, 40, 72, 58, 90, 66];
  return (
    <div className="space-y-3 p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">Score distribution</span>
        <span className="text-xs font-medium text-emerald-500">88.8% pass</span>
      </div>
      <div className="flex h-16 items-end gap-1.5">
        {bars.map((h, i) => (
          <div key={i} className="flex-1 overflow-hidden rounded-[4px] bg-muted" style={{ height: '100%' }}>
            <div
              className="w-full rounded-[4px] bg-primary/70"
              style={{ height: `${h}%`, transformOrigin: 'bottom', animation: `bar-grow 1.1s ${i * 0.08}s cubic-bezier(.16,1,.3,1) both` }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

const STEPS: Step[] = [
  { id: 'student', title: 'Take exams calmly', body: 'Question navigation, countdown, autosave, and instant results for every candidate.', ui: <StudentPanel /> },
  { id: 'instructor', title: 'Author, schedule, monitor', body: 'Build question banks, template exams, schedule sessions, and monitor candidates live.', ui: <InstructorPanel /> },
  { id: 'admin', title: 'Oversee everything', body: 'Manage users, roles, and system activity with full audit trails and analytics.', ui: <AdminPanel /> },
  { id: 'proctor', title: 'Monitor in real time', body: 'Webcam, fullscreen, and tab-switch state monitored and flagged as candidates work.', ui: <ProctorPanel /> },
  { id: 'analytics', title: 'Learn from results', body: 'Score distribution, pass rates, and item-level analysis flow automatically.', ui: <AnalyticsPanel /> },
];

export function NarrativeSection() {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion() ?? false;
  const [active, setActive] = useState(0);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end 0.8'],
  });

  useMotionValueEvent(scrollYProgress, 'change', (v) => {
    if (reduce) return;
    const idx = Math.min(STEPS.length - 1, Math.max(0, Math.floor(v * STEPS.length)));
    setActive(idx);
  });

  return (
    <section id="narrative" className="relative border-y border-border/60 bg-card/20 py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-6">
        <div className="max-w-2xl">
          <Reveal style="none">
            <span className="eyebrow">
              <span className="eyebrow-dot" />
              One product, every role
            </span>
            <h2 className="mt-5 text-[1.7rem] font-semibold leading-[1.15] tracking-tight text-foreground sm:text-3xl">
              <WrapUpText lines={['Watch the exam move', 'through the platform']} />
            </h2>
            <p className="mt-4 text-[0.95rem] leading-relaxed text-muted-foreground">
              Scroll to step the same exam through each role — student, instructor, admin, proctoring, and analytics.
            </p>
          </Reveal>
        </div>

        <div ref={ref} className="relative mt-14">
          <div className="lg:sticky lg:top-24 lg:grid lg:grid-cols-2 lg:items-center lg:gap-14">
            {/* Left — synced step copy */}
            <div className="order-2 mt-10 lg:order-1 lg:mt-0">
              <div className="space-y-8">
                {STEPS.map((s, i) => (
                  <div key={s.id} className={cn('transition-opacity duration-500', i === active ? 'opacity-100' : 'opacity-35')}>
                    <div className="flex items-center gap-2 text-sm">
                      <span className={cn('h-1.5 w-1.5 rounded-full transition-colors', i === active ? 'bg-primary' : 'bg-border')} />
                      <span className="font-semibold text-foreground">{s.title}</span>
                    </div>
                    <p className="mt-2 pl-3.5 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Right — pinned interface that transforms */}
            <div className="order-1 lg:order-2">
              <div className="relative">
                <div className="pointer-events-none absolute -inset-8 -z-10 rounded-[2.5rem] bg-primary/10 blur-3xl" />
                <div className="glass-panel glass-edge overflow-hidden rounded-2xl">
                  <div className="flex items-center justify-between border-b border-border/60 px-4 py-2.5">
                    <p className="font-mono text-[0.65rem] text-muted-foreground">oes · workspace</p>
                    <span className="flex items-center gap-1.5 text-[0.65rem] font-medium text-emerald-400">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                      Synced
                    </span>
                  </div>
                  <div className="relative">
                    {STEPS.map((s, i) => (
                      <motion.div
                        key={s.id}
                        className={cn('rounded-2xl')}
                        style={{ position: i === 0 ? 'relative' : 'absolute', inset: i === 0 ? undefined : 0 }}
                        initial={false}
                        animate={
                          reduce
                            ? { opacity: i === 0 ? 1 : 0 }
                            : {
                                opacity: i === active ? 1 : 0,
                                filter: i === active ? 'blur(0px)' : 'blur(10px)',
                                scale: i === active ? 1 : 0.97,
                              }
                        }
                        transition={{ duration: 0.55, ease: EASE }}
                      >
                        <div className="flex items-center justify-between bg-background/40 px-5 py-2.5">
                          <span className="text-xs font-medium capitalize text-muted-foreground">{s.id}</span>
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        </div>
                        {s.ui}
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}