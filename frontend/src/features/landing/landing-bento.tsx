'use client';

import { useReducedMotion } from 'framer-motion';
import { FilePen, BarChart3, ShieldCheck, Radar } from 'lucide-react';
import { Reveal, SectionHeader, Counter, TiltCard, useLandingStats } from './landing-primitives';

/* ------------------------------------------------------------------ */
/* Real stat strip (fetched from backend; falls back to zeros)        */
/* ------------------------------------------------------------------ */
export function StatsStrip() {
  const stats = useLandingStats();

  const items = [
    { label: 'Active students', value: stats.students, suffix: '+' },
    { label: 'Exams conducted', value: stats.exams, suffix: '+' },
    { label: 'Instructors', value: stats.instructors, suffix: '+' },
    { label: 'Questions in bank', value: stats.questions, suffix: '+' },
  ];

  return (
    <section className="border-y border-border/60 bg-card/30 backdrop-blur-sm">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-px px-5 sm:px-6 md:grid-cols-4">
        {items.map((s, i) => (
          <Reveal key={s.label} style="none" delay={i * 0.06}>
            <div className="flex flex-col gap-1 py-8 text-center">
              <span className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                <Counter value={s.value} suffix={s.suffix} />
              </span>
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {s.label}
              </span>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
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
    <section id="product" className="relative py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-6">
        <SectionHeader
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
            <div className="flex h-full flex-col justify-between rounded-2xl border border-border/60 bg-card/50 p-6 backdrop-blur-xl transition-colors hover:border-border">
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
                  <span className="text-2xl font-semibold tracking-tight text-foreground">88.8%</span>
                  <span className="text-xs font-medium text-emerald-400">pass rate</span>
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
    </section>
  );
}
