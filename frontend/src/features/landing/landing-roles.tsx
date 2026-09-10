'use client';

import { useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  GraduationCap,
  BookOpenCheck,
  Settings2,
  CheckCircle2,
  CalendarDays,
  Timer,
  Trophy,
  FileText,
  ListChecks,
  Radio,
  BarChart3,
} from 'lucide-react';
import { SectionHeader, Reveal, WrapUpText, Parallax, SectionReveal } from './landing-primitives';
import { NetworkOrb } from './landing-art';
import { Webcam, Shield } from './landing-objects';
import { cn } from '@/lib/utils';

/* ---------------- Student visual ---------------- */
function StudentUI() {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-xl border border-border/50 bg-card/40 p-4">
        <div>
          <p className="text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">Upcoming exam</p>
          <p className="mt-1 text-sm font-semibold text-foreground">CS302 · Database Systems</p>
          <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <CalendarDays className="h-3 w-3 text-primary" /> Today 15:30
            </span>
            <span className="flex items-center gap-1">
              <Timer className="h-3 w-3 text-primary" /> 90 min
            </span>
          </div>
        </div>
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <BookOpenCheck className="h-5 w-5" />
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FloatingMetric label="Average score" value="84%" up />
        <FloatingMetric label="Completed" value="12" />
      </div>

      <div className="flex items-center justify-between rounded-xl border border-border/50 bg-card/40 px-4 py-3 text-xs">
        <span className="text-muted-foreground">Recent result</span>
        <span className="flex items-center gap-1.5 font-medium text-gold-strong">
          <Trophy className="h-3.5 w-3.5" /> 92%
        </span>
      </div>
    </div>
  );
}

function FloatingMetric({ label, value, up }: { label: string; value: string; up?: boolean }) {
  return (
    <div className="rounded-xl border border-border/50 bg-card/40 p-4">
      <p className="text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
        {value}
        {up && <span className="ml-1 text-xs font-medium text-emerald-500">↗</span>}
      </p>
    </div>
  );
}

/* ---------------- Instructor visual ---------------- */
function InstructorUI() {
  const rows = [
    { q: '1. Default port of PostgreSQL', tag: '1 pt', c: 'text-emerald-500' },
    { q: '2. Explain 3NF requirements', tag: '4 pts', c: 'text-amber-500' },
    { q: '3. Write a nested join query', tag: '5 pts', c: 'text-rose-500' },
  ];
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border/50 bg-card/40 p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">CS302 · Question bank</p>
          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[0.65rem] font-medium text-primary">
            32 items
          </span>
        </div>
        <div className="mt-3 space-y-2">
          {rows.map((r) => (
            <div key={r.q} className="flex items-center justify-between rounded-lg border border-border/50 bg-background/40 px-3 py-2 text-xs">
              <span className="text-muted-foreground">{r.q}</span>
              <span className={cn('font-medium', r.c)}>{r.tag}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-border/50 bg-card/40 p-4">
          <p className="text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">Published</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">18</p>
        </div>
        <div className="rounded-xl border border-border/50 bg-card/40 p-4">
          <p className="text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">Awaiting review</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">6</p>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Admin visual ---------------- */
function AdminUI() {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-border/50 bg-card/40 p-4">
          <p className="text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">Managed users</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">2,483</p>
        </div>
        <div className="rounded-xl border border-border/50 bg-card/40 p-4">
          <p className="text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">Server load</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">12%</p>
        </div>
      </div>
      <div className="space-y-1.5 rounded-xl border border-border/50 bg-card/40 p-3">
        <p className="mb-2 flex items-center gap-1.5 text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">
          <ListChecks className="h-3.5 w-3.5 text-gold-strong" /> Audit log
        </p>
        {['Exam CS302 published', 'Student cs-290 submitted', 'Role instructor granted'].map((l) => (
          <div key={l} className="flex items-center gap-2 font-mono text-[0.65rem] text-muted-foreground">
            <CheckCircle2 className="h-3 w-3 text-emerald-500/80" /> {l}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Proctor visual ---------------- */
function ProctorUI() {
  const rows: Array<[string, string, string]> = [
    ['Fullscreen', 'Active', 'text-emerald-500'],
    ['Tab switching', 'Flagged', 'text-amber-500'],
    ['Webcam', 'Live', 'text-emerald-500'],
  ];
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 rounded-xl border border-border/50 bg-card/40 p-4">
        <Webcam className="h-10 w-14 shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-foreground">Candidate cs-290</p>
          <p className="text-xs text-emerald-500">Identity verified</p>
        </div>
        <Shield className="h-8 w-7 shrink-0 text-primary" />
      </div>
      <div className="space-y-1.5">
        {rows.map(([k, v, c]) => (
          <div key={k} className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{k}</span>
            <span className={cn('font-medium', c)}>{v}</span>
          </div>
        ))}
      </div>
      <div className="rounded-lg border border-border/50 bg-background/40 px-3 py-2">
        <p className="text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">Live board</p>
        <div className="mt-1.5 flex gap-1">
          {[0, 1, 2, 3, 4].map((i) => (
            <span key={i} className={cn('h-1.5 flex-1 rounded-full', i < 4 ? 'bg-emerald-500/80' : 'bg-muted')} />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Analytics visual ---------------- */
function AnalyticsUI() {
  const bars = [34, 52, 40, 72, 58, 90, 66];
  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border/50 bg-card/40 p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">Score distribution</p>
          <span className="flex items-center gap-1.5 text-[0.65rem] font-medium text-gold-strong">
            <BarChart3 className="h-3 w-3" /> live
          </span>
        </div>
        <div className="mt-3 flex h-16 items-end gap-1.5">
          {bars.map((h, i) => (
            <div key={i} className="flex-1 overflow-hidden rounded-[4px] bg-muted" style={{ height: '100%' }}>
              <div
                className="w-full rounded-[4px] bg-gradient-to-t from-primary/70 to-gold/70"
                style={{ height: `${h}%`, transformOrigin: 'bottom' }}
              />
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {['Item analysis', 'Completion rate', 'Anomaly flags'].map((k) => (
          <span key={k} className="rounded-full border border-border/50 bg-card/40 px-3 py-1.5 text-[0.65rem] font-medium text-muted-foreground">
            {k}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Role definitions ---------------- */
const roles = [
  {
    id: 'student',
    label: 'Student',
    eyebrow: 'For students',
    title: 'A calm place to sit & submit',
    body: 'A focused exam dashboard with question navigation, countdown, autosave, and instant results after submission.',
    points: ['Question navigation', 'Live countdown', 'Instant results'],
    icon: GraduationCap,
    accent: 'text-primary bg-primary/12',
    ui: <StudentUI />,
  },
  {
    id: 'instructor',
    label: 'Instructor',
    eyebrow: 'For instructors',
    title: 'Author, schedule, and monitor',
    body: 'A workspace for question banks, exam templates, session scheduling, and monitoring candidates as they take exams.',
    points: ['Question banks', 'Exam templates', 'Candidate monitoring'],
    icon: FileText,
    accent: 'text-gold-strong bg-gold/10',
    ui: <InstructorUI />,
  },
  {
    id: 'admin',
    label: 'Admin',
    eyebrow: 'For administrators',
    title: 'Full oversight, zero guesswork',
    body: 'Manage users, roles, exams, and system activity from a single operational view with audit trails and analytics.',
    points: ['Users & roles', 'System activity', 'Analytics'],
    icon: Settings2,
    accent: 'text-amber-500 bg-amber-500/12',
    ui: <AdminUI />,
  },
  {
    id: 'proctor',
    label: 'Proctor',
    eyebrow: 'For proctors',
    title: 'Watch everything, in real time',
    body: 'Live webcam, fullscreen, and tab-switch state for every candidate — with automatic flags and a full audit trail.',
    points: ['Live webcam state', 'Tab & fullscreen flags', 'Audit trail'],
    icon: Radio,
    accent: 'text-emerald-500 bg-emerald-500/12',
    ui: <ProctorUI />,
  },
  {
    id: 'analytics',
    label: 'Analytics',
    eyebrow: 'For reviewers',
    title: 'Learn from every result',
    body: 'Score distribution, item analysis, and completion patterns flow in automatically as soon as submissions arrive.',
    points: ['Score distribution', 'Item-level analysis', 'Completion patterns'],
    icon: BarChart3,
    accent: 'text-primary bg-primary/12',
    ui: <AnalyticsUI />,
  },
];

export function RolesSection() {
  const [active, setActive] = useState(0);
  const reduce = useReducedMotion() ?? false;
  const role = roles[active];
  const Icon = role.icon;

  return (
    <SectionReveal id="roles" mode="fade-scale" className="relative isolate py-20 md:py-28">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <Parallax speed={100} className="absolute inset-x-0 top-8 mx-auto h-96 w-[48rem] rounded-full bg-primary/8 blur-3xl" />
        <NetworkOrb className="absolute -left-6 top-40 hidden h-44 w-48 text-primary/35 lg:block" />
      </div>

      <div className="mx-auto max-w-6xl px-5 sm:px-6">
        <SectionHeader
          eyebrow="Who it's for"
          title={<WrapUpText lines={['One platform,', 'five workspaces']} />}
          sub="Every role gets its own tailored surface — switch between them to see how each team works."
        />

        {/* Tab bar */}
        <Reveal style="none" className="mt-10">
          <div
            role="tablist"
            aria-label="Platform roles"
            className="mx-auto flex max-w-full flex-wrap items-center justify-center gap-2"
          >
            {roles.map((r, i) => {
              const TabIcon = r.icon;
              const isActive = i === active;
              return (
                <button
                  key={r.id}
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActive(i)}
                  className={cn(
                    'relative flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-all duration-300',
                    isActive
                      ? 'border-primary/40 bg-primary/10 text-foreground shadow-sm shadow-primary/10'
                      : 'border-border/60 bg-card/40 text-muted-foreground hover:border-border hover:text-foreground',
                  )}
                >
                  <TabIcon className="h-3.5 w-3.5" />
                  {r.label}
                  {isActive && (
                    <motion.span
                      layoutId="role-tab-glow"
                      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                      className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-gold"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </Reveal>

        {/* Active role — copy + preview */}
        <div className="mt-12 grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
          {/* Copy */}
          <AnimatePresence mode="wait">
            <motion.div
              key={role.id}
              initial={reduce ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduce ? undefined : { opacity: 0, y: -12 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            >
              <span className="eyebrow">
                <span className="eyebrow-dot-gold" />
                {role.eyebrow}
              </span>
              <div className={`mt-6 flex h-11 w-11 items-center justify-center rounded-xl ${role.accent} lg:hidden`}>
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-5 text-2xl font-semibold leading-tight tracking-tight text-foreground sm:text-[1.7rem]">
                {role.title}
              </h3>
              <p className="mt-3 max-w-md text-[0.95rem] leading-relaxed text-muted-foreground">{role.body}</p>
              <ul className="mt-6 flex flex-wrap gap-2">
                {role.points.map((p) => (
                  <li
                    key={p}
                    className="flex items-center gap-1.5 rounded-full border border-border/60 bg-card/40 px-3 py-1.5 text-xs font-medium text-muted-foreground"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 text-gold-strong" />
                    {p}
                  </li>
                ))}
              </ul>
            </motion.div>
          </AnimatePresence>

          {/* Preview */}
          <AnimatePresence mode="wait">
            <motion.div
              key={role.id}
              initial={reduce ? false : { opacity: 0, y: 20, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduce ? undefined : { opacity: 0, y: -12, scale: 0.99 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="mx-auto w-full max-w-md"
            >
              <div className="glass-panel glass-edge hairline-top overflow-hidden rounded-2xl">
                <div className="flex items-center justify-between border-b border-border/60 px-4 py-2.5">
                  <span className={cn('flex h-8 w-8 items-center justify-center rounded-lg p-1.5', role.accent)}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="flex items-center gap-2 text-[0.65rem] font-medium text-muted-foreground">
                    <span className="rounded-full border border-border/60 bg-card/60 px-2 py-0.5 uppercase tracking-wide">
                      Demo
                    </span>
                    <span className="flex items-center gap-1.5 text-emerald-400">
                      <span className="relative flex h-1.5 w-1.5">
                        {!reduce && (
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                        )}
                        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      </span>
                      Live
                    </span>
                  </span>
                </div>
                <div className={cn('bg-background/40 p-5')}>{role.ui}</div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </SectionReveal>
  );
}