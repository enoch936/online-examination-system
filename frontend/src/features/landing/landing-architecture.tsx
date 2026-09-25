'use client';

import { Network, Video, Zap, Database, KeyRound, Eye } from 'lucide-react';
import { SectionHeader, Reveal, TiltCard, Parallax, SectionReveal } from './landing-primitives';
import { cn } from '@/lib/utils';

const layers = [
  {
    icon: Network,
    title: 'WebSocket',
    desc: 'Persistent, low-latency channels keep exam state, submissions, flags, and results synchronized.',
    tag: 'Real-time',
  },
  {
    icon: Video,
    title: 'WebRTC',
    desc: 'Bidirectional media lets proctors and candidates share live audio, video, and signals in-session.',
    tag: 'Live media',
  },
  {
    icon: Zap,
    title: 'Redis',
    desc: 'In-memory session state and presence data keep hot paths fast and resume-friendly.',
    tag: 'Low latency',
  },
  {
    icon: Database,
    title: 'PostgreSQL',
    desc: 'Durable storage for exams, questions, attempts, results, and audit history.',
    tag: 'Relational',
  },
  {
    icon: KeyRound,
    title: 'Role-based access',
    desc: 'Every route and action is scoped by role — students, instructors, proctors, and admins.',
    tag: 'RBAC',
  },
  {
    icon: Eye,
    title: 'Proctoring',
    desc: 'Webcam, fullscreen, and tab-switch signals are ingested and flagged continuously.',
    tag: 'Enforced',
  },
];

const pipeline = ['Client', 'WebSocket', 'Redis', 'PostgreSQL', 'Workers'];

export function ArchitectureSection() {
  return (
    <SectionReveal id="architecture" mode="wipe-left" className="relative isolate py-20 md:py-28">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <Parallax speed={140} className="absolute -left-32 top-24 h-80 w-80 rounded-full bg-gold/7 blur-3xl" />
      </div>

      <div className="mx-auto max-w-6xl px-5 sm:px-6">
        <SectionHeader
          align="right"
          reveal="fade-right"
          eyebrow="Under the hood"
          title="Engineered for real-time examinations"
          sub="The stack is chosen for one thing: state that stays synchronized from the first question to the final result."
        />

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {layers.map((l, i) => {
            const Icon = l.icon;
            return (
              <Reveal key={l.title} style={(['rise-rotate', 'tumble-in', 'swing', 'blur-scale', 'clip-up', 'zoom-up'] as const)[i % 6]} delay={i * 0.06}>
                <TiltCard spotlight max={5} className="h-full">
                  <div
                    className={cn(
                      'card-lift flex h-full flex-col rounded-2xl border border-border/60 bg-card/50 p-6 backdrop-blur-xl',
                    )}
                  >
                    <div
                      className={cn(
                        'flex h-10 w-10 items-center justify-center rounded-xl',
                        i === 0 ? 'border border-gold/30 bg-gold/10 text-gold-strong' : 'bg-primary/12 text-primary',
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="mt-5 flex items-center gap-2">
                      <h3 className="text-base font-semibold tracking-tight text-foreground">{l.title}</h3>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{l.desc}</p>
                    <span className="mt-4 inline-flex w-fit items-center rounded-full border border-border/60 bg-card/60 px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
                      {l.tag}
                    </span>
                  </div>
                </TiltCard>
              </Reveal>
            );
          })}
        </div>

        {/* Data-flow pipeline */}
        <Reveal style="none" delay={0.1} className="mt-12">
          <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/30 backdrop-blur-xl">
            <div className="mask-fade-x flex flex-wrap items-center justify-center gap-2 px-4 py-5">
              {pipeline.map((p, i) => (
                <div key={p} className="flex items-center gap-2">
                  <span
                    className={cn(
                      'rounded-xl border px-4 py-2 font-mono text-xs font-semibold',
                      p === 'WebSocket'
                        ? 'border-gold/40 bg-gold/10 text-gold-strong'
                        : 'border-border/60 bg-card/60 text-foreground',
                    )}
                  >
                    {p}
                  </span>
                  {i < pipeline.length - 1 && <span className="text-muted-foreground/60">→</span>}
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </SectionReveal>
  );
}