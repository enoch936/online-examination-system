'use client';

import { useRef, useState } from 'react';
import { motion, useScroll, useMotionValueEvent, useReducedMotion } from 'framer-motion';
import { BadgeCheck, ShieldCheck, Activity } from 'lucide-react';
import { Reveal, WrapUpText, Parallax } from './landing-primitives';
import { ScanRings } from './landing-art';
import { Webcam, Shield } from './landing-objects';
import { cn } from '@/lib/utils';

const EASE = [0.16, 1, 0.3, 1] as const;

/* ------------------------------------------------------------------ */
/* Sticky scroll narrative — pivots through live-monitoring states.    */
/* Blur -> transform -> sharp as scroll progress advances a step.      */
/* ------------------------------------------------------------------ */

type Row = { k: string; v: string; tone: 'ok' | 'warn' | 'dim' };
type Step = {
  id: string;
  title: string;
  body: string;
  focus: string;
  rows: Row[];
  feed: string[];
};

const STEPS: Step[] = [
  {
    id: 'identity',
    title: 'Identity verified',
    body: 'Webcam frames match the enrollment photo before the clock starts — sessions begin only for confirmed candidates.',
    focus: 'Identity check',
    rows: [
      { k: 'Identity', v: 'Verified', tone: 'ok' },
      { k: 'Fullscreen', v: 'Active', tone: 'dim' },
      { k: 'Webcam', v: 'Live', tone: 'ok' },
    ],
    feed: ['cs-290 · identity verified', 'cs-284 · identity verified', 'cs-266 · photo match confirmed'],
  },
  {
    id: 'behavior',
    title: 'Fullscreen enforced',
    body: 'Candidates stay inside the secure client. Leaving the tab or window raises a flag and a guard message.',
    focus: 'Session state',
    rows: [
      { k: 'Identity', v: 'Verified', tone: 'ok' },
      { k: 'Fullscreen', v: 'Enforced', tone: 'ok' },
      { k: 'Webcam', v: 'Live', tone: 'ok' },
    ],
    feed: ['cs-273 · entered fullscreen', 'cs-258 · window focus locked', 'cs-277 · fullscreen active'],
  },
  {
    id: 'flags',
    title: 'Anomalies auto-flagged',
    body: 'Tab switches, occluded faces, and repeated motion are flagged automatically for human review.',
    focus: 'Anomaly flags',
    rows: [
      { k: 'Tab switching', v: 'Flagged', tone: 'warn' },
      { k: 'Face occluded', v: 'Flagged', tone: 'warn' },
      { k: 'Webcam', v: 'Live', tone: 'ok' },
    ],
    feed: ['cs-266 · flagged: tab switch', 'cs-277 · flagged: face occluded', 'cs-290 · review pending'],
  },
  {
    id: 'sync',
    title: 'State stays in sync',
    body: 'Every answer autosaves over the connection. A dropped link resumes instantly — nothing is lost.',
    focus: 'Session sync',
    rows: [
      { k: 'Autosave', v: 'Synced', tone: 'ok' },
      { k: 'Connection', v: 'Stable · 24ms', tone: 'ok' },
      { k: 'Webcam', v: 'Live', tone: 'ok' },
    ],
    feed: ['cs-258 · autosave synced', 'cs-290 · session resumed', 'cs-301 · progress saved'],
  },
  {
    id: 'delivery',
    title: 'Results delivered',
    body: 'Completed sessions close cleanly, grading runs instantly, and scores flow to scorecards, certificates, and analytics.',
    focus: 'Delivery',
    rows: [
      { k: 'Submission', v: 'Received', tone: 'ok' },
      { k: 'Grading', v: 'Complete', tone: 'ok' },
      { k: 'Results', v: 'Synced', tone: 'ok' },
    ],
    feed: ['cs-302 · submitted exam', 'cs-302 · auto-graded', 'cs-302 · scorecard released'],
  },
];

function toneClass(tone: Row['tone']) {
  switch (tone) {
    case 'ok':
      return { text: 'text-emerald-500', dot: 'bg-emerald-500', chip: 'bg-emerald-500/10 border-emerald-500/25' };
    case 'warn':
      return { text: 'text-amber-500', dot: 'bg-amber-500', chip: 'bg-amber-500/10 border-amber-500/25' };
    default:
      return { text: 'text-foreground', dot: 'bg-foreground/40', chip: 'bg-background/40 border-border/50' };
  }
}

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

  const step = STEPS[active];

  return (
    <section id="narrative" className="relative isolate border-y border-border/60 bg-card/20 pb-20 md:pb-28">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <Parallax speed={130} className="absolute -right-32 bottom-0 h-80 w-80 rounded-full bg-gold/8 blur-3xl" />
        <Parallax speed={70} className="absolute -left-24 top-16 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
      </div>

      <div className="w-full">
        <div className="max-w-none">
          <Reveal style="none">
            <span className="eyebrow">
              <span className="eyebrow-dot-gold" />
              Real-time monitoring
            </span>
            <h2 className="mt-5 text-[1.7rem] font-semibold leading-[1.15] tracking-tight text-foreground sm:text-3xl">
              <WrapUpText lines={['Watch an exam come', 'alive in real time']} />
            </h2>
            <p className="mt-4 text-[0.95rem] leading-relaxed text-muted-foreground">
              Scroll to step the proctor console through identity checks, enforcement, anomaly flags, sync, and delivery.
            </p>
          </Reveal>
        </div>

        <div ref={ref} className="relative mt-14">
          <div className="lg:sticky lg:top-24 lg:grid lg:grid-cols-2 lg:items-center lg:gap-14">
            {/* Board — pinned left, transforms through monitoring states */}
            <div className="order-1 lg:order-1">
              <div className="relative">
                <div className="pointer-events-none absolute -inset-8 -z-10 rounded-[2.5rem] bg-primary/10 blur-3xl" />
                <div className="pointer-events-none absolute -inset-4 -z-10 flex items-center justify-center opacity-60">
                  <ScanRings className="h-80 w-80" />
                </div>
                <div className="glass-panel glass-edge hairline-top overflow-hidden rounded-2xl">
                  <div className="flex items-center justify-between border-b border-border/60 px-4 py-2.5">
                    <p className="font-mono text-[0.65rem] text-muted-foreground">oes · proctor console</p>
                    <span className="flex items-center gap-1.5 text-[0.65rem] font-medium text-emerald-400">
                      <span className="relative flex h-1.5 w-1.5">
                        {!reduce && (
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                        )}
                        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      </span>
                      Synced
                    </span>
                  </div>
                  <div className="relative">
                    {STEPS.map((s, i) => (
                      <motion.div
                        key={s.id}
                        className="rounded-2xl"
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
                        <div className="space-y-3 p-5">
                          {/* Focus label */}
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-medium text-foreground">{s.focus}</span>
                            <span className="text-[0.65rem] text-muted-foreground">stage 0{i + 1} / 05</span>
                          </div>
                          {/* Candidate identity */}
                          <div className="flex items-center gap-3">
                            <div className="relative overflow-hidden rounded-xl border border-border/50 bg-card/60 p-2">
                              <Webcam className="h-12 w-16" />
                              {!reduce && (
                                <motion.div
                                  aria-hidden
                                  className="absolute inset-x-2 h-px bg-emerald-500/70"
                                  initial={{ top: '8%', opacity: 0 }}
                                  animate={{ top: ['8%', '88%', '8%'], opacity: [0, 1, 0] }}
                                  transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
                                />
                              )}
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-semibold text-foreground">Candidate cs-290</p>
                              <p className="text-xs text-emerald-500">Identity verified</p>
                            </div>
                            <Shield className="h-8 w-7 shrink-0 text-primary" />
                          </div>

                          {/* Session state rows */}
                          <div className="space-y-1.5">
                            {s.rows.map((r) => {
                              const t = toneClass(r.tone);
                              return (
                                <div key={r.k} className="flex items-center justify-between text-xs">
                                  <span className="text-muted-foreground">{r.k}</span>
                                  <span className={cn('flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-medium', t.chip, t.text)}>
                                    <span className={cn('h-1.5 w-1.5 rounded-full', t.dot)} />
                                    {r.v}
                                  </span>
                                </div>
                              );
                            })}
                          </div>

                          {/* Event feed */}
                          <div className="rounded-lg border border-border/50 bg-background/40 px-3 py-2">
                            <p className="mb-1.5 text-[0.6rem] font-semibold uppercase tracking-wide text-muted-foreground">
                              Event stream
                            </p>
                            <div className="space-y-0.5">
                              {s.feed.map((f) => (
                                <motion.p
                                  key={f}
                                  initial={reduce ? false : { opacity: 0, x: -6 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ duration: 0.4 }}
                                  className="flex items-center gap-1.5 font-mono text-[0.62rem] text-muted-foreground"
                                >
                                  <span className={cn('h-1 w-1 shrink-0 rounded-full', f.includes('flagged') ? 'bg-amber-500' : 'bg-emerald-500')} />
                                  <span className="truncate">{f}</span>
                                </motion.p>
                              ))}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>

                {/* Floating chips overlapping the board */}
                <div className="float-soft absolute -left-5 top-14 z-20 hidden items-center gap-2 rounded-xl border border-border/60 bg-card/85 px-3 py-2 text-xs font-medium text-foreground shadow-lg shadow-black/10 backdrop-blur-xl lg:flex">
                  <BadgeCheck className="h-3.5 w-3.5 text-emerald-500" />
                  Identity verified
                </div>
                <div
                  className="float-soft absolute -right-4 bottom-12 z-20 hidden items-center gap-2 rounded-xl border border-border/60 bg-card/85 px-3 py-2 text-xs font-medium text-foreground shadow-lg shadow-black/10 backdrop-blur-xl lg:flex"
                  style={{ animationDelay: '1.4s' }}
                >
                  <Activity className="h-3.5 w-3.5 text-gold-strong" />
                  <span className="flex items-center gap-1.5">0 violations · synced</span>
                </div>
                <div
                  className="float-soft absolute -top-4 right-8 z-20 hidden items-center gap-1.5 rounded-full border border-gold/30 bg-gold/10 px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-wide text-gold-strong shadow-sm lg:flex"
                  style={{ animationDelay: '0.7s' }}
                >
                  <ShieldCheck className="h-3 w-3" />
                  Live proctoring
                </div>
              </div>
            </div>

            {/* Copy — synced step list alongside the pinned board */}
            <div className="order-2 mt-10 lg:order-2 lg:mt-0">
              <div className="space-y-8">
                {STEPS.map((s, i) => (
                  <div key={s.id} className={cn('transition-opacity duration-500', i === active ? 'opacity-100' : 'opacity-35')}>
                    <div className="flex items-center gap-2 text-sm">
                      <span className={cn('h-1.5 w-1.5 rounded-full transition-colors', i === active ? 'bg-gold' : 'bg-border')} />
                      <span className="font-semibold text-foreground">{s.title}</span>
                    </div>
                    <p className="mt-2 pl-3.5 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}