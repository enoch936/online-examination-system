'use client';

import Link from 'next/link';
import { motion, useScroll, useTransform, useReducedMotion, useInView } from 'framer-motion';
import { useRef } from 'react';
import { ShieldCheck, Radio, Cpu, Layers, ArrowRight, Lock } from 'lucide-react';
import { SectionHeader, Reveal, TiltCard } from './landing-primitives';

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

export function SecuritySection() {
  return (
    <section id="security" className="relative border-y border-border/60 bg-card/20 py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-5 sm:px-6">
        <SectionHeader
          eyebrow="The fundamentals"
          title="Secure, real-time, and built to scale"
        />

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {principles.map((p, i) => {
            const Icon = p.icon;
            const secStyle = (['zoom-up', 'flip-in', 'pop', 'blur'] as const)[i % 4];
            return (
              <Reveal key={p.key} style={secStyle} delay={i * 0.07}>
                <TiltCard spotlight max={5} className="h-full">
                  <div className="flex h-full flex-col rounded-2xl border border-border/60 bg-card/50 p-6 backdrop-blur-xl">
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
    </section>
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
    <section className="relative overflow-hidden py-24 md:py-32">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-1/2 h-[420px] w-[720px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-[140px]" />
      </div>

      <div className="mx-auto max-w-4xl px-5 sm:px-6">
        <div ref={ref} className="relative">
          {/* Glass panel forming behind CTA */}
          <motion.div
            className="absolute inset-0 -z-10 rounded-3xl border border-border/50 bg-card/40 backdrop-blur-xl"
            initial={reduce ? false : { opacity: 0, scale: 0.96, filter: 'blur(10px)' }}
            animate={inView ? { opacity: 1, scale: 1, filter: 'blur(0px)' } : {}}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
          />
          <div className="glass-edge flex flex-col items-center gap-6 px-6 py-16 text-center sm:px-12 sm:py-20">
            <span className="eyebrow">
              <span className="eyebrow-dot" />
              Get started
            </span>
            <h2 className="max-w-xl text-[1.7rem] font-semibold leading-[1.15] tracking-tight text-foreground sm:text-3xl">
              Ready to run your next exam with confidence?
            </h2>
            <p className="max-w-md text-[0.95rem] leading-relaxed text-muted-foreground">
              Set up your institution in minutes — no complex deployment required.
            </p>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/register"
                className="group inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:bg-primary/90 active:scale-[0.98]"
              >
                Get started free
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-xl border border-border bg-card/40 px-6 py-3 text-sm font-semibold text-foreground backdrop-blur-md transition-colors hover:bg-card/70"
              >
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                Log in
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
