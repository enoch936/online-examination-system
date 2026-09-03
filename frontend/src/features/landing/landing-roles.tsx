'use client';

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
} from 'lucide-react';
import { SectionHeader, Reveal, TiltCard, OverlapReveal, WrapUpText } from './landing-primitives';

/* ---------------- Student visual ---------------- */
function StudentUI() {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-xl border border-border/50 bg-card/40 p-4">
        <div>
          <p className="text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">
            Upcoming exam
          </p>
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
        <span className="flex items-center gap-1.5 font-medium text-emerald-500">
          <Trophy className="h-3.5 w-3.5" /> 92%
        </span>
      </div>
    </div>
  );
}

function FloatingMetric({
  label,
  value,
  up,
}: {
  label: string;
  value: string;
  up?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border/50 bg-card/40 p-4">
      <p className="text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
        {value}
        {up && <span className="ml-1 text-xs font-medium text-emerald-500">↑</span>}
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
              <span className={`font-medium ${r.c}`}>{r.tag}</span>
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
          <p className="text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">Users</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">2,483</p>
        </div>
        <div className="rounded-xl border border-border/50 bg-card/40 p-4">
          <p className="text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">Server load</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">12%</p>
        </div>
      </div>
      <div className="space-y-1.5 rounded-xl border border-border/50 bg-card/40 p-3">
        <p className="mb-2 flex items-center gap-1.5 text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">
          <ListChecks className="h-3.5 w-3.5 text-accent" /> Audit log
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

const roleDefs = [
  {
    id: 'student',
    eyebrow: 'For students',
    title: 'A calm place to sit & submit',
    body: 'A focused exam dashboard with question navigation, countdown, autosave, and instant results after submission.',
    ui: <StudentUI />,
    points: ['Question navigation', 'Live countdown', 'Instant results'],
    icon: GraduationCap,
    accent: 'text-primary bg-primary/12',
    feature: 'Flexible',
  },
  {
    id: 'instructor',
    eyebrow: 'For instructors',
    title: 'Author, schedule, and monitor',
    body: 'A workspace for question banks, exam templates, session scheduling, and monitoring candidates as they take exams.',
    ui: <InstructorUI />,
    points: ['Question banks', 'Exam templates', 'Candidate monitoring'],
    icon: FileText,
    accent: 'text-accent bg-accent/12',
    feature: 'Precise',
  },
  {
    id: 'admin',
    eyebrow: 'For administrators',
    title: 'Full oversight, zero guesswork',
    body: 'Manage users, roles, exams, and system activity from a single operational view with audit trails and analytics.',
    ui: <AdminUI />,
    points: ['Users & roles', 'System activity', 'Analytics'],
    icon: Settings2,
    accent: 'text-amber-500 bg-amber-500/12',
    feature: 'Scalable',
  },
];

export function RolesSection() {
  return (
    <section id="roles" className="relative py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-6">
        <SectionHeader
          eyebrow="Who it's for"
          title={<WrapUpText lines={['One platform,', 'three workspaces']} />}
          sub="Each role gets its own tailored surface — no clutter, no overlap."
        />

        <div className="mt-16 flex flex-col gap-20">
          {roleDefs.map((role, idx) => {
            const Icon = role.icon;
            const reversed = idx % 2 === 1;
            return (
              <div
                key={role.id}
                className="grid items-center gap-8 lg:grid-cols-2 lg:gap-14"
              >
                {/* Text */}
                <OverlapReveal
                  from={reversed ? 'left' : 'right'}
                  delay={idx * 0.05}
                  className={reversed ? 'lg:order-2' : ''}
                >
                  <div>
                    <span className="eyebrow">
                      <span className="eyebrow-dot" />
                      {role.eyebrow}
                    </span>
                    <div className={`mt-6 flex h-11 w-11 items-center justify-center rounded-xl ${role.accent} lg:hidden`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="mt-5 text-2xl font-semibold leading-tight tracking-tight text-foreground sm:text-[1.7rem]">
                      {role.title}
                    </h3>
                    <p className="mt-3 max-w-md text-[0.95rem] leading-relaxed text-muted-foreground">
                      {role.body}
                    </p>
                    <ul className="mt-6 flex flex-wrap gap-2">
                      {role.points.map((p) => (
                        <li
                          key={p}
                          className="flex items-center gap-1.5 rounded-full border border-border/60 bg-card/40 px-3 py-1.5 text-xs font-medium text-muted-foreground"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                          {p}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-6 inline-flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                      {role.feature}
                    </p>
                  </div>
                </OverlapReveal>

                {/* Visual */}
                <Reveal
                  style={(['expand-out', 'diagonal-bl', 'perspective-in'] as const)[idx % 3]}
                  className={reversed ? 'lg:order-1' : ''}
                >
                  <TiltCard spotlight max={4} className="mx-auto w-full max-w-md">
                    <div className="rounded-2xl border border-border/60 bg-card/50 p-5 backdrop-blur-xl">
                      <div className="mb-4 flex items-center justify-between">
                        <Icon className={`flex h-8 w-8 items-center justify-center rounded-lg ${role.accent} p-1.5`} />
                        <span className="flex items-center gap-1.5 text-[0.65rem] font-medium text-emerald-400">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          Live
                        </span>
                      </div>
                      {role.ui}
                    </div>
                  </TiltCard>
                </Reveal>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
