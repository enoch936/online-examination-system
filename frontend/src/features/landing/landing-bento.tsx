'use client';

import { useReducedMotion } from 'framer-motion';
import { FilePen, BarChart3, ShieldCheck, Radar, Radio, Video, Cpu, Activity, Lock, CheckCircle2 } from 'lucide-react';
import { Reveal, SectionHeader, SectionReveal, TiltCard, Parallax } from './landing-primitives';
import { NetworkOrb } from './landing-art';

/* ------------------------------------------------------------------ */
/* Capability strip — product capabilities (no fabricated figures)    */
/* ------------------------------------------------------------------ */
const capabilities = [
  { icon: Radio, label: 'Real-time monitoring', desc: 'WebSocket-synced exam state' },
  { icon: Video, label: 'Webcam proctoring', desc: 'Identity checks & live flags' },
  { icon: Cpu, label: 'Auto-grading', desc: 'Instant scoring, rubric support' },
  { icon: ShieldCheck, label: 'Role-based access', desc: 'RBAC across every workspace' },
  { icon: Activity, label: 'Live exam state', desc: 'Submissions & results sync' },
  { icon: Lock, label: 'Secure sessions', desc: 'Encrypted, scoped, audited' },
];

export function CapabilitiesStrip() {
  return (
    <SectionReveal mode="wipe-up" className="relative border-y border-border/60 bg-card/20">
      <div className="mx-auto max-w-6xl px-5 py-10 sm:px-6 md:py-12">
        <div className="flex items-center gap-2.5 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          <span className="eyebrow-dot-gold" />
          Capabilities
        </div>
        <div className="mt-7 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border/60 bg-border/60 md:grid-cols-3 lg:grid-cols-6">
          {capabilities.map((c, i) => {
            const Icon = c.icon;
            return (
              <Reveal key={c.label} style="none" delay={i * 0.05}>
                <div className="group flex h-full flex-col gap-3.5 bg-background/60 p-5 transition-colors duration-300 hover:bg-card">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/60 bg-card text-primary transition-colors duration-300 group-hover:border-gold/50 group-hover:text-gold">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-[0.82rem] font-semibold tracking-tight text-foreground">{c.label}</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{c.desc}</p>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </SectionReveal>
  );
}

/* ------------------------------------------------------------------ */
/* Bento — asymmetric product features with miniature visual UIs       */
/* ------------------------------------------------------------------ */
function MiniBars() {
  const reduce = useReducedMotion() ?? false;
  const heights = [34, 52, 40, 72, 58, 90];
  return (
    <div className="flex h-16 items-end gap-1.5">
      {heights.map((h, i) => (
        <div
          key={i}
          className="flex-1 overflow-hidden rounded-[4px] bg-muted"
          style={{ height: '100%', display: 'flex', alignItems: 'flex-end' }}
        >
          <div
            className="w-full rounded-[4px] bg-primary/70"
            style={{
              height: reduce ? `${h}%` : `${h}%`,
              transformOrigin: 'bottom',
              animation: reduce
                ? undefined
                : `bar-grow 1.1s ${i * 0.08}s cubic-bezier(.16,1,.3,1) both`,
            }}
          />
        </div>
      ))}
    </div>
  );
}

export function BentoSection() {
  return (
    <SectionReveal id="product" mode="expand-in" className="relative isolate py-20 md:py-28">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <Parallax speed={150} className="absolute -right-24 top-16 h-80 w-80 rounded-full bg-primary/15 blur-3xl" />
        <Parallax speed={60} className="absolute -bottom-24 left-8 h-64 w-64 rounded-full bg-gold/8 blur-3xl" />
        <NetworkOrb className="absolute right-10 top-32 hidden h-40 w-44 text-primary/35 md:block" />
      </div>

      <div className="mx-auto max-w-6xl px-5 sm:px-6">
        <SectionHeader
          align="left"
          reveal="blur"
          eyebrow="Platform capabilities"
          title="Everything an exam requires, in one workspace"
          sub="Asymmetric tools that move work forward — creation, security, monitoring, and analytics under a single surface."
        />

        <div className="mt-14 grid gap-4 md:grid-cols-3">
          {/* Large card — exam creation (zoom-up) */}
          <Reveal style="zoom-up" className="md:row-span-2">
            <TiltCard
              spotlight
              className="h-full"
            >
            <div className="relative flex h-full flex-col justify-between rounded-2xl border border-border/60 bg-card/50 p-6 backdrop-blur-xl transition-colors hover:border-border">
              <span className="float-soft absolute -right-3 -top-3 z-10 flex items-center gap-1.5 rounded-full border border-gold/30 bg-gold/10 px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-wide text-gold-strong shadow-sm">
                <CheckCircle2 className="h-3 w-3" />
                Auto-scored
              </span>
              <div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/12 text-primary">
                  <FilePen className="h-5 w-5" />
                </div>
                <h3 className="mt-5 text-lg font-semibold tracking-tight text-foreground">
                  Exam management
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Create templates, schedule sessions, randomize questions, and set scoring rules —
                  all with granular control per course and cohort.
                </p>
              </div>

              {/* Mini editor UI */}
              <div className="mt-8 space-y-2">
                {[
                  { q: 'Q1 · PostgreSQL default port', tag: 'EASY', color: 'text-emerald-500' },
                  { q: 'Q2 · Explain 3NF', tag: 'MED', color: 'text-amber-500' },
                  { q: 'Q3 · Write join query', tag: 'HARD', color: 'text-rose-500' },
                ].map((r) => (
                  <div
                    key={r.q}
                    className="flex items-center justify-between rounded-lg border border-border/50 bg-background/40 px-3 py-2 text-xs"
                  >
                    <span className="text-muted-foreground">{r.q}</span>
                    <span className={`text-[0.6rem] font-semibold ${r.color}`}>{r.tag}</span>
                  </div>
                ))}
                <div className="flex items-center justify-center rounded-lg border border-dashed border-border/60 py-2 text-xs text-muted-foreground">
                  + Add question
                </div>
              </div>
            </div>
            </TiltCard>
          </Reveal>

          {/* Right: analytics mini (contract-in) */}
          <Reveal style="contract-in" className="md:col-span-2">
            <TiltCard
              spotlight
              className="h-full"
            >
            <div className="flex h-full flex-col justify-between rounded-2xl border border-border/60 bg-card/50 p-6 backdrop-blur-xl md:flex-row md:items-center md:gap-6">
              <div className="max-w-[14rem]">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 text-accent">
                  <BarChart3 className="h-5 w-5" />
                </div>
                <h3 className="mt-5 text-lg font-semibold tracking-tight text-foreground">
                  Performance analytics
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Score distribution, item analysis, and completion rates.
                </p>
              </div>
              <div className="mt-6 w-full md:mt-0 md:flex-1">
                <div className="mb-3 flex items-end justify-between">
                  <span className="text-sm font-semibold tracking-tight text-foreground">Score distribution</span>
                  <span className="text-xs font-medium text-muted-foreground">item × response</span>
                </div>
                <MiniBars />
              </div>
            </div>
            </TiltCard>
          </Reveal>

          {/* Right small — security (fade-left) */}
          <Reveal style="fade-left" className="md:col-span-1">
            <TiltCard
              spotlight
              className="h-full"
            >
            <div className="flex h-full items-center gap-5 rounded-2xl border border-border/60 bg-card/50 p-6 backdrop-blur-xl">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-500">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-semibold tracking-tight text-foreground">Secure by default</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  Locked-down browsers, identity checks, and audit trails.
                </p>
              </div>
            </div>
            </TiltCard>
          </Reveal>

          {/* Bottom-left wide — real-time (circling) */}
          <Reveal style="circling" className="md:col-span-1 md:row-span-1">
            <TiltCard
              spotlight
              className="h-full"
            >
            <div className="flex h-full flex-col justify-between rounded-2xl border border-border/60 bg-card/50 p-6 backdrop-blur-xl">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-500">
                <Radar className="h-5 w-5" />
              </div>
              <div>
                <h3 className="mt-4 text-lg font-semibold tracking-tight text-foreground">
                  Real-time
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  Live session state and monitoring as exams happen.
                </p>
              </div>
            </div>
            </TiltCard>
          </Reveal>
        </div>
      </div>
    </SectionReveal>
  );
}
