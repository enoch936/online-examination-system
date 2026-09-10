'use client';

import Link from 'next/link';
import { motion, useReducedMotion, useInView } from 'framer-motion';
import { useRef } from 'react';
import { ShieldCheck, Radio, Cpu, Layers, ArrowRight, Lock, BadgeCheck, Video, ScrollText, KeyRound } from 'lucide-react';
import { SectionHeader, Reveal, TiltCard, Parallax, SectionReveal } from './landing-primitives';
import { AuroraBand } from './landing-art';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/* Security / trust — compact principle grid                            */
/* ------------------------------------------------------------------ */
const principles = [
  {
    key: 'Secure',
    title: 'Role-based access',
    desc: 'Granular RBAC and audit trails for every action.',
    icon: Lock,
  },
  {
    key: 'Real-time',
    title: 'Live examination state',
    desc: 'Session and monitoring state updates as exams run.',
    icon: Radio,
  },
  {
    key: 'Intelligent',
    title: 'Automated monitoring',
    desc: 'Proctoring flags anomalies without constant attention.',
    icon: Cpu,
  },
  {
    key: 'Scalable',
    title: 'Built for institutions',
    desc: 'Handles thousands of concurrent candidates reliably.',
    icon: Layers,
  },
];

const states = [
  { label: 'Secure session', icon: Lock, tone: 'text-gold-strong border-gold/30 bg-gold/10' },
  { label: 'Identity verified', icon: BadgeCheck, tone: 'text-emerald-500 border-emerald-500/25 bg-emerald-500/10' },
  { label: 'Webcam active', icon: Video, tone: 'text-emerald-500 border-emerald-500/25 bg-emerald-500/10' },
  { label: 'Audit trail', icon: ScrollText, tone: 'text-primary border-primary/25 bg-primary/10' },
  { label: 'Role verified', icon: KeyRound, tone: 'text-gold-strong border-gold/30 bg-gold/10' },
];

export function SecuritySection() {
  return (
    <SectionReveal
      id="security"
      mode="rise-impact"
      className="relative isolate border-y border-border/60 bg-card/20 py-20 md:py-28"
    >
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <Parallax speed={120} className="absolute -right-28 top-16 h-80 w-80 rounded-full bg-gold/7 blur-3xl" />
        <Parallax speed={60} className="absolute -left-28 bottom-8 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
      </div>

      <div className="mx-auto max-w-6xl px-5 sm:px-6">
        <SectionHeader
          align="left"
          reveal="fade-left"
          eyebrow="The fundamentals"
          title="Secure, real-time, and built to scale"
        />

        {/* Security state chips */}
        <Reveal style="none" delay={0.05} className="mt-8">
          <div className="flex flex-wrap items-center justify-center gap-2 lg:justify-start">
            {states.map((s, i) => {
              const Icon = s.icon;
              return (
                <motion.span
                  key={s.label}
                  initial={false}
                  animate={{ opacity: 1, x: 0 }}
                  style={{ transitionDelay: `${i * 40}ms` }}
                  className={cn(
                    'flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold',
                    s.tone,
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {s.label}
                </motion.span>
              );
            })}
          </div>
        </Reveal>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {principles.map((p, i) => {
            const Icon = p.icon;
            const secStyle = (['tumble-in', 'swing', 'rise-rotate', 'clip-up'] as const)[i % 4];
            return (
              <Reveal key={p.key} style={secStyle} delay={i * 0.07}>
                <TiltCard spotlight max={5} className="h-full">
                  <div className="card-lift flex h-full flex-col rounded-2xl border border-border/60 bg-card/50 p-6 backdrop-blur-xl">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/12 text-primary">
                      <Icon className="h-5 w-5" />
                    </div>
                    <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {p.key}
                    </p>
                    <h3 className="mt-1 text-base font-semibold tracking-tight text-foreground">
                      {p.title}
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{p.desc}</p>
                  </div>
                </TiltCard>
              </Reveal>
            );
          })}
        </div>
      </div>
    </SectionReveal>
  );
}

/* ------------------------------------------------------------------ */
/* CTA — a large glass exam panel forms as you approach                 */
/* ------------------------------------------------------------------ */
export function CTASection() {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion() ?? false;
  const inView = useInView(ref, { once: false, margin: '-20%' });

  return (
    <SectionReveal mode="expand-in" className="relative overflow-hidden py-24 md:py-32">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <AuroraBand />
        <Parallax speed={90} className="absolute inset-x-0 bottom-0 top-0 mx-auto my-auto h-[420px] w-[720px] rounded-full bg-primary/10 blur-3xl" />
        <Parallax speed={150} className="absolute left-[62%] top-[30%] h-56 w-56 rounded-full bg-gold/10 blur-3xl" />
        <Parallax speed={50} className="absolute -left-24 bottom-0 h-72 w-72 rounded-full bg-primary/8 blur-3xl" />
      </div>

      <div className="mx-auto max-w-4xl px-5 sm:px-6">
        <div ref={ref} className="relative">
          {/* Floating chips framing the CTA panel */}
          <div
            className="float-soft absolute -left-10 top-10 z-20 hidden items-center gap-2 rounded-xl border border-border/60 bg-card/85 px-3 py-2 text-xs font-medium text-foreground shadow-lg shadow-black/10 backdrop-blur-xl lg:flex"
          >
            <Cpu className="h-3.5 w-3.5 text-gold-strong" />
            Auto-graded · rubric ready
          </div>
          <div
            className="float-soft absolute -right-12 top-1/2 z-20 hidden items-center gap-2 rounded-xl border border-border/60 bg-card/85 px-3 py-2 text-xs font-medium text-foreground shadow-lg shadow-black/10 backdrop-blur-xl lg:flex"
            style={{ animationDelay: '1.6s' }}
          >
            <Video className="h-3.5 w-3.5 text-emerald-500" />
            Monitoring active
          </div>
          <div
            className="float-soft absolute -left-6 bottom-10 z-20 hidden items-center gap-1.5 rounded-full border border-gold/30 bg-gold/10 px-3 py-1.5 text-[0.65rem] font-semibold uppercase tracking-wide text-gold-strong lg:flex"
            style={{ animationDelay: '0.8s' }}
          >
            <BadgeCheck className="h-3 w-3" />
            Role verified
          </div>

          {/* Glass panel forming behind CTA */}
          <motion.div
            className="absolute inset-0 -z-10 rounded-3xl bg-gradient-to-br from-gold/25 via-transparent to-primary/25 p-px"
            initial={reduce ? false : { opacity: 0, scale: 0.96, filter: 'blur(10px)' }}
            animate={inView ? { opacity: 1, scale: 1, filter: 'blur(0px)' } : {}}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="h-full w-full rounded-3xl bg-background/60 backdrop-blur-xl" />
          </motion.div>

          <div className="glass-edge flex flex-col items-center gap-6 px-6 py-16 text-center sm:px-12 sm:py-20">
            <span className="eyebrow">
              <span className="eyebrow-dot-gold" />
              Get started
            </span>
            <h2 className="max-w-2xl text-[1.9rem] font-semibold leading-[1.12] tracking-tight text-foreground sm:text-[2.4rem]">
              Run your next exam{' '}
              <span className="text-gold-gradient">with confidence.</span>
            </h2>
            <p className="max-w-md text-[0.95rem] leading-relaxed text-muted-foreground">
              Create, schedule, monitor, and grade in one surface — no complex deployment required.
            </p>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/register"
                className="btn-shine glow-gold-soft group inline-flex items-center gap-2 rounded-xl bg-gradient-to-br from-gold-strong to-gold px-7 py-3 text-sm font-semibold text-gold-foreground transition-all hover:brightness-105 active:scale-[0.98]"
              >
                Get started
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="#product"
                className="group inline-flex items-center gap-2 rounded-xl border border-border bg-card/40 px-7 py-3 text-sm font-semibold text-foreground backdrop-blur-md transition-colors hover:bg-card/70"
              >
                <Radio className="h-4 w-4 text-primary" />
                Explore the platform
              </Link>
            </div>
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              Role-based access · audit trails · real-time monitoring
            </p>
          </div>
        </div>
      </div>
    </SectionReveal>
  );
}