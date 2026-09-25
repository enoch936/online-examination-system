'use client';

import { useEffect, useState } from 'react';
import { motion, useReducedMotion, AnimatePresence } from 'framer-motion';
import {
  FilePlus2,
  Send,
  CalendarClock,
  PlayCircle,
  MonitorCheck,
  SendHorizonal,
  Cpu,
  Trophy,
  Check,
  CheckCircle2,
} from 'lucide-react';
import { SectionHeader, Reveal, WrapUpText, Parallax, SectionReveal } from './landing-primitives';
import { Smartboard } from './landing-objects';
import { cn } from '@/lib/utils';

const stages = [
  { n: 1, id: 'create', label: 'Create', icon: FilePlus2 },
  { n: 2, id: 'publish', label: 'Publish', icon: Send },
  { n: 3, id: 'schedule', label: 'Schedule', icon: CalendarClock },
  { n: 4, id: 'start', label: 'Start', icon: PlayCircle },
  { n: 5, id: 'monitor', label: 'Monitor', icon: MonitorCheck },
  { n: 6, id: 'submit', label: 'Submit', icon: SendHorizonal },
  { n: 7, id: 'evaluate', label: 'Evaluate', icon: Cpu },
  { n: 8, id: 'results', label: 'Results', icon: Trophy },
];

const detail: Record<string, { title: string; note: string }> = {
  create: { title: 'Author an exam', note: 'Compose questions, sections, randomization, and marking rules.' },
  publish: { title: 'Publish to cohorts', note: 'Release the exam to assigned courses and student groups.' },
  schedule: { title: 'Set timing & rules', note: 'Define duration, window, attempts, and lockdown requirements.' },
  start: { title: 'Launch sessions', note: 'Candidates open the secure client across devices.' },
  monitor: { title: 'Live proctoring', note: 'Webcam, tab-switching, and fullscreen state monitored in real time.' },
  submit: { title: 'Collect submissions', note: 'Autosave and secure submission with connection recovery.' },
  evaluate: { title: 'Auto-grade', note: 'Instant scoring with rubric support for manual questions.' },
  results: { title: 'Release results', note: 'Scorecards, certificates, and analytics for review.' },
};

export function LifecycleSection() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduce = useReducedMotion() ?? false;
  const activeStage = stages[active];

  // Auto-advance the pipeline (pauses while the user explores)
  useEffect(() => {
    if (reduce || paused) return;
    const id = setInterval(() => setActive((a) => (a + 1) % stages.length), 3200);
    return () => clearInterval(id);
  }, [reduce, paused]);

  const progress = reduce ? 1 : active / (stages.length - 1);

  return (
    <SectionReveal
      id="lifecycle"
      mode="rise-impact"
      className="relative isolate border-y border-border/60 bg-card/20 py-20 md:py-28"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <Parallax speed={120} className="absolute -right-32 top-1/3 h-96 w-96 rounded-full bg-gold/8 blur-3xl" />
      </div>

      <div className="mx-auto max-w-6xl px-5 sm:px-6">
        <SectionHeader
          align="left"
          reveal="expand-out"
          eyebrow="Exam lifecycle"
          title={<WrapUpText lines={['From question to certificate']} />}
          sub="A connected pipeline that carries every exam from creation through monitoring to results."
        />

        <div className="mt-14 grid gap-10 lg:grid-cols-[1fr_1.05fr] lg:gap-8 lg:items-center">
          {/* Pipeline */}
          <div className="relative" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
            {/* Progress rail */}
            <div className="absolute bottom-6 left-[1.15rem] top-6 hidden w-px bg-border/40 sm:block">
              <motion.div
                className="absolute inset-y-0 left-0 w-full origin-top bg-gradient-to-b from-gold via-primary to-primary"
                animate={{ scaleY: progress }}
                transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>

            <div className="flex flex-col gap-2">
              {stages.map((s, i) => {
                const Icon = s.icon;
                const done = i < active;
                const isActive = i === active;
                return (
                  <Reveal key={s.id} style="none" delay={i * 0.03}>
                    <button
                      onMouseEnter={() => setActive(i)}
                      onFocus={() => setActive(i)}
                      onClick={() => setActive(i)}
                      className={cn(
                        'group relative flex w-full items-center gap-3 rounded-xl px-1 py-2 text-left transition-all sm:pl-3',
                        isActive ? 'sm:-translate-x-1' : 'opacity-75 hover:opacity-100',
                      )}
                    >
                      <span
                        className={cn(
                          'relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-sm transition-all duration-300',
                          done && 'border-gold/50 bg-gold/10 text-gold-strong',
                          isActive &&
                            'border-primary/50 bg-primary text-primary-foreground shadow-md shadow-primary/25',
                          !done && !isActive && 'border-border/70 bg-card/60 text-muted-foreground',
                        )}
                      >
                        {done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                      </span>
                      <span className="min-w-0">
                        <span
                          className={cn(
                            'block text-[0.95rem] font-medium transition-colors',
                            isActive || done ? 'text-foreground' : 'text-muted-foreground',
                          )}
                        >
                          {s.label}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {detail[s.id].note}
                        </span>
                      </span>
                      <span
                        className={cn(
                          'ml-auto hidden text-xs font-semibold tabular-nums sm:block',
                          isActive || done ? 'text-foreground' : 'text-muted-foreground',
                        )}
                      >
                        0{i + 1}
                      </span>
                    </button>
                  </Reveal>
                );
              })}
            </div>
          </div>

          {/* Preview panel */}
          <Reveal style="zoom-in" delay={0.1}>
            <div className="glass-panel glass-edge hairline-top overflow-hidden rounded-2xl">
              <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
                <div className="min-w-0">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={activeStage.id}
                      initial={reduce ? false : { opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={reduce ? undefined : { opacity: 0, y: -8 }}
                      transition={{ duration: 0.25 }}
                    >
                      <h3 className="text-base font-semibold tracking-tight text-foreground">
                        {detail[activeStage.id].title}
                      </h3>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Stage {activeStage.n} of {stages.length}
                      </p>
                    </motion.div>
                  </AnimatePresence>
                </div>
                <span className="flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-400">
                  <span className="relative flex h-1.5 w-1.5">
                    {!reduce && (
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                    )}
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  </span>
                  Live
                </span>
              </div>

              <div className="space-y-3 p-5">
                {/* Progress head */}
                <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                  <span>{detail[activeStage.id].note}</span>
                  <span className="tabular-nums">0{activeStage.n} / 08</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <motion.div
                    layout
                    className="h-full rounded-full bg-gradient-to-r from-primary via-primary to-gold"
                    animate={{ width: `${((active + 1) / stages.length) * 100}%` }}
                    transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                  />
                </div>

                {/* Stage-specific mini UI */}
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeStage.id}
                    initial={reduce ? false : { opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduce ? undefined : { opacity: 0, y: -10 }}
                    transition={{ duration: 0.25 }}
                    className="mt-2 flex min-h-[10rem] flex-col justify-center gap-3 rounded-xl border border-border/50 bg-background/40 p-4"
                  >
                    {activeStage.id === 'monitor' && (
                      <>
                        <div className="flex items-center gap-3">
                          <Smartboard className="h-10 w-16 shrink-0" />
                          <div className="flex-1">
                            <p className="text-xs font-medium text-foreground">Live proctoring board</p>
                            <p className="text-[0.65rem] text-muted-foreground">Markers draw the session state</p>
                          </div>
                        </div>
                        {[['Fullscreen', 'Active'], ['Tab switching', 'Flagged'], ['Webcam', 'Live']].map(
                          ([k, v]) => (
                            <div key={k} className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">{k}</span>
                              <span
                                className={cn(
                                  'font-medium',
                                  v === 'Flagged' ? 'text-amber-500' : 'text-emerald-500',
                                )}
                              >
                                {v}
                              </span>
                            </div>
                          ),
                        )}
                        <div className="mt-1 flex gap-1">
                          {[0, 1, 2, 3].map((i) => (
                            <span
                              key={i}
                              className={cn(
                                'h-1.5 flex-1 rounded-full',
                                i < 3 ? 'bg-emerald-500/80' : 'bg-muted',
                              )}
                            />
                          ))}
                        </div>
                      </>
                    )}

                    {activeStage.id === 'results' && (
                      <div>
                        <div className="flex items-center gap-3">
                          <span className="glow-gold flex h-11 w-11 items-center justify-center rounded-xl border border-gold/40 bg-gold/10 text-gold-strong">
                            <Trophy className="h-5 w-5" />
                          </span>
                          <div>
                            <p className="text-sm font-semibold text-foreground">Results released</p>
                            <p className="text-xs text-muted-foreground">Scorecards are synced to candidates</p>
                          </div>
                        </div>
                        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                          {['Scorecards', 'Certificates', 'Analytics'].map((k) => (
                            <div key={k} className="rounded-lg border border-border/50 bg-background/60 px-2 py-2">
                              <CheckCircle2 className="mx-auto mb-1.5 h-4 w-4 text-gold-strong" />
                              <p className="text-[0.6rem] uppercase tracking-wide text-muted-foreground">{k}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {activeStage.id !== 'monitor' && activeStage.id !== 'results' && (
                      <>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span
                            className={cn(
                              'flex h-7 w-7 items-center justify-center rounded-lg',
                              activeStage.id === 'create' || activeStage.id === 'publish'
                                ? 'bg-gold/10 text-gold-strong'
                                : 'bg-primary/10 text-primary',
                            )}
                          >
                            {(() => {
                              const I = activeStage.icon;
                              return <I className="h-3.5 w-3.5" />;
                            })()}
                          </span>
                          {detail[activeStage.id].title}
                        </div>
                        <div className="flex gap-2">
                          <span className="rounded-full bg-muted px-2.5 py-1 text-[0.65rem] text-muted-foreground">
                            CS302 · DBMS
                          </span>
                          <span className="rounded-full bg-muted px-2.5 py-1 text-[0.65rem] text-muted-foreground">
                            Cohort 2026
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-center">
                          {[['Scheduled', '128'], [activeStage.id === 'create' ? 'Drafts' : 'Started', '96'], ['Done', '—']].map(
                            ([k, v]) => (
                              <div key={k} className="rounded-lg bg-background/60 px-2 py-2">
                                <p className="text-base font-semibold text-foreground">{v}</p>
                                <p className="text-[0.6rem] uppercase tracking-wide text-muted-foreground">{k}</p>
                              </div>
                            ),
                          )}
                        </div>
                      </>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </SectionReveal>
  );
}