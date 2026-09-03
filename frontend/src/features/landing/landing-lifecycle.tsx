'use client';

import { useState } from 'react';
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
} from 'lucide-react';
import { SectionHeader, Reveal, WrapUpText } from './landing-primitives';
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
  const reduce = useReducedMotion() ?? false;
  const activeStage = stages[active];

  return (
    <section id="lifecycle" className="relative border-y border-border/60 bg-card/20 py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-6">
        <SectionHeader
          eyebrow="Exam lifecycle"
          title={<WrapUpText lines={['From question to certificate']} />}
          sub="A connected pipeline that carries every exam from creation through monitoring to results."
        />

        <div className="mt-14 grid gap-10 lg:grid-cols-[1fr_1fr] lg:items-center">
          {/* Timeline list */}
          <div className="relative">
            <div className="absolute bottom-4 left-[1.15rem] top-4 hidden w-px bg-gradient-to-b from-border to-border/30 sm:block" />
            <div className="flex flex-col gap-1">
              {stages.map((s, i) => {
                const Icon = s.icon;
                const isActive = i === active;
                const stageStyle = (['right', 'left', 'zoom-in', 'pop', 'drop-in', 'blur', 'flip-in', 'circling'] as const)[i % 8];
                return (
                  <Reveal key={s.id} style={stageStyle} delay={i * 0.04}>
                    <button
                      onMouseEnter={() => setActive(i)}
                      onFocus={() => setActive(i)}
                      onClick={() => setActive(i)}
                      className={cn(
                        'group relative flex w-full items-center gap-3 rounded-xl px-1 py-2 text-left transition-all sm:pl-3',
                        isActive ? 'sm:-translate-x-1' : 'opacity-70 hover:opacity-100',
                      )}
                    >
                      <span
                        className={cn(
                          'relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border text-sm transition-all',
                          isActive
                            ? 'border-primary/50 bg-primary text-primary-foreground shadow-md shadow-primary/25'
                            : 'border-border/70 bg-card/60 text-muted-foreground',
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0">
                        <span
                          className={cn(
                            'block text-[0.95rem] font-medium transition-colors',
                            isActive ? 'text-foreground' : 'text-muted-foreground',
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
                          isActive ? 'text-foreground' : 'text-muted-foreground',
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
            <motion.div
              layout
              className="glass-panel glass-edge overflow-hidden rounded-2xl"
            >
              <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
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
                <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
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
                    className="h-full rounded-full bg-primary"
                    animate={{ width: `${(activeStage.n / stages.length) * 100}%` }}
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
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground">Average score</p>
                          <p className="text-3xl font-semibold tracking-tight text-foreground">87%</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">Pass rate</p>
                          <p className="text-3xl font-semibold tracking-tight text-emerald-500">88.8%</p>
                        </div>
                      </div>
                    )}

                    {activeStage.id !== 'monitor' && activeStage.id !== 'results' && (
                      <>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
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
            </motion.div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
