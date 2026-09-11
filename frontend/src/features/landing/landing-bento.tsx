'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { FilePen, BarChart3, ShieldCheck, Radar, Radio, Video, Cpu, Activity, Lock, CheckCircle2 } from 'lucide-react';
import { Reveal, SectionHeader, SectionReveal, TiltCard, Parallax, useRevealGate } from './landing-primitives';
import { cn } from '@/lib/utils';

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

type CapabilityChipProps = {
  icon: typeof Radio;
  label: string;
  desc: string;
  index: number;
};

function CapabilityChip({ icon: Icon, label, desc, index }: CapabilityChipProps) {
  const { ref, shown, reduce } = useRevealGate();
  const target: { opacity: 1; x: 0 } = { opacity: 1, x: 0 };
  const hidden = { opacity: 0, x: 24 };
  return (
    <motion.div
      ref={ref as React.Ref<HTMLDivElement>}
      initial={reduce ? false : hidden}
      animate={shown ? target : hidden}
      transition={{ delay: reduce ? 0 : index * 0.06, duration: reduce ? 0 : 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="group flex items-center gap-3 rounded-xl border border-border/60 bg-card/40 px-4 py-3 transition-colors duration-300 hover:border-gold/40"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary transition-colors duration-300 group-hover:bg-gold/10 group-hover:text-gold-strong">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-[0.8rem] font-semibold tracking-tight text-foreground">{label}</p>
        <p className="truncate text-xs text-muted-foreground">{desc}</p>
      </div>
      <CheckCircle2 className="ml-auto h-3.5 w-3.5 shrink-0 text-gold-strong/60 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
    </motion.div>
  );
}

export function CapabilitiesStrip() {
  const reduce = useReducedMotion() ?? false;

  const tiles = capabilities.map((c, i) => {
    const a = (i / capabilities.length) * Math.PI * 2 - Math.PI / 2;
    return { c, x: Math.cos(a) * 112, y: Math.sin(a) * 112 };
  });

  return (
    <SectionReveal mode="wipe-up" className="relative isolate border-y border-border/60 bg-card/20">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <Parallax speed={110} className="absolute -left-24 top-1/2 h-72 w-72 -translate-y-1/2 rounded-full bg-primary/10 blur-3xl" />
        <Parallax speed={60} className="absolute -right-20 bottom-0 h-64 w-64 rounded-full bg-gold/8 blur-3xl" />
      </div>

      <div className="w-full pb-16 md:pb-20">
        <div className="grid items-center gap-14 lg:grid-cols-[minmax(0,26rem)_1fr] lg:gap-20">
          {/* Left — circular capability cluster with overlay */}
          <div className="relative mx-auto h-[19rem] w-[19rem] sm:h-[21rem] sm:w-[21rem]">
            {/* Halo + glass overlay */}
            <div className="absolute -inset-6 -z-10 rounded-full bg-primary/10 blur-3xl" />
            <div className="absolute -inset-3 -z-10 rounded-full border border-white/10 bg-gradient-to-br from-primary/8 via-transparent to-gold/8" />

            {/* Rotating rings */}
            <div className="absolute inset-0 -z-10 rounded-full border border-dashed border-border/40" />
            <motion.div
              aria-hidden
              className="absolute inset-3 -z-10 rounded-full border-2 border-transparent border-t-gold/60"
              animate={reduce ? { rotate: 0 } : { rotate: 360 }}
              transition={{ duration: 24, repeat: Infinity, ease: 'linear' }}
            />
            <motion.div
              aria-hidden
              className="absolute inset-8 -z-10 rounded-full border-2 border-transparent border-b-primary/50"
              animate={reduce ? { rotate: 0 } : { rotate: -360 }}
              transition={{ duration: 32, repeat: Infinity, ease: 'linear' }}
            />

            {/* Center plaque */}
            <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2 text-center">
              <span className="glow-gold flex h-14 w-14 items-center justify-center rounded-full border border-gold/40 bg-gold/10 text-gold-strong">
                <ShieldCheck className="h-6 w-6" />
              </span>
              <p className="text-sm font-semibold tracking-tight text-foreground">Live platform</p>
              <p className="text-[0.62rem] uppercase tracking-[0.18em] text-muted-foreground">6 capabilities</p>
            </div>

            {/* Orbital capability tiles */}
            {tiles.map(({ c, x, y }, i) => {
              const Icon = c.icon;
              return (
                <div
                  key={c.label}
                  className="absolute left-1/2 top-1/2 z-10"
                  style={{ transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))` }}
                >
                  <motion.div
                    initial={reduce ? false : { scale: 0, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.35 + i * 0.09, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                    className={cn(
                      'group flex h-[4.6rem] w-[4.6rem] flex-col items-center justify-center gap-1 rounded-2xl border bg-card/85 text-primary shadow-lg shadow-black/5 backdrop-blur-xl transition-colors duration-300',
                      'border-border/60 hover:border-gold/50 hover:text-gold-strong',
                    )}
                  >
                    <Icon className="h-5 w-5 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:scale-110" />
                    <span className="text-center text-[0.55rem] font-semibold uppercase leading-tight tracking-wide text-foreground/80">
                      {c.label}
                    </span>
                  </motion.div>
                </div>
              );
            })}

            {/* Overlay status chip */}
            <span className="float-soft absolute -right-1 top-8 z-20 flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-[0.62rem] font-semibold text-emerald-400 backdrop-blur">
              <span className="relative flex h-1.5 w-1.5">
                {!reduce && (
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                )}
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </span>
              Synced · live
            </span>
          </div>

          {/* Right — copy + descriptor list */}
          <div>
            <Reveal style="fade-right">
              <span className="eyebrow">
                <span className="eyebrow-dot-gold" />
                Platform capabilities
              </span>
              <h2 className="mt-5 text-[1.7rem] font-semibold leading-[1.15] tracking-tight text-foreground sm:text-3xl">
                Six capabilities, one live surface
              </h2>
              <p className="mt-4 max-w-md text-[0.95rem] leading-relaxed text-muted-foreground">
                Everything an exam needs runs together during every session — from proctoring to grading —
                connected by a single real-time state.
              </p>
            </Reveal>
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {capabilities.map((c, i) => {
                const Icon = c.icon;
                return (
                  <CapabilityChip key={c.label} icon={Icon} label={c.label} desc={c.desc} index={i} />
                );
              })}
            </div>
          </div>
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
    <SectionReveal id="product" mode="expand-in" className="relative isolate pb-20 md:pb-28">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <Parallax speed={150} className="absolute -right-24 top-16 h-80 w-80 rounded-full bg-primary/15 blur-3xl" />
        <Parallax speed={60} className="absolute -bottom-24 left-8 h-64 w-64 rounded-full bg-gold/8 blur-3xl" />
      </div>

      <div className="w-full">
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
