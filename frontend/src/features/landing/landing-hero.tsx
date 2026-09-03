'use client';

import Link from 'next/link';
import { useRef } from 'react';
import {
  motion,
  useScroll,
  useTransform,
  useMotionValue,
  useSpring,
  useMotionTemplate,
  useReducedMotion,
  type MotionValue,
} from 'framer-motion';
import { ArrowRight, Play, ShieldCheck, Clock3, Radio, CheckCircle2, AlertTriangle, TerminalSquare } from 'lucide-react';
import { TypingText, TypeLoop, ScrambleText, MaskedReveal, MOTION } from './landing-primitives';
import { TypeCycler } from './landing-typewriter';
import { OrbitObjects, Pencil, Book, TimerObject, Webcam, Certificate } from './landing-objects';

/* Decorative floating exam UI cards that parallax at different speeds */
function FloatingCards({ progress }: { progress: MotionValue<number> }) {
  const reduce = useReducedMotion() ?? false;
  const y1 = useTransform(progress, [0, 1], [0, -60]);
  const y2 = useTransform(progress, [0, 1], [0, -25]);
  const y3 = useTransform(progress, [0, 1], [0, -95]);
  const fade = useTransform(progress, [0, 0.6], [1, 0]);

  if (reduce) {
    return <></>;
  }

  return (
    <>
      {/* Floating notification — top left */}
      <motion.div
        style={{ y: y1, opacity: fade }}
        className="absolute -left-6 top-6 z-20 hidden rounded-2xl border border-border/60 bg-card/80 p-3 shadow-xl shadow-black/10 backdrop-blur-xl sm:block"
      >
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-400">
            <ShieldCheck className="h-4 w-4" />
          </span>
          <div className="pr-1">
            <p className="text-xs font-semibold text-foreground">Monitoring active</p>
            <p className="text-[0.65rem] text-muted-foreground">Webcam · Fullscreen · Tab</p>
          </div>
        </div>
      </motion.div>

      {/* Floating score card — top right */}
      <motion.div
        style={{ y: y2, opacity: fade }}
        className="absolute -right-4 -top-10 z-20 hidden rounded-2xl border border-border/60 bg-card/85 p-3 shadow-xl shadow-black/10 backdrop-blur-xl sm:block"
      >
        <p className="text-[0.65rem] font-medium text-muted-foreground">Grade</p>
        <div className="flex items-end gap-1">
          <span className="text-xl font-semibold tracking-tight text-foreground">87</span>
          <span className="mb-0.5 text-xs text-emerald-400">+4%</span>
        </div>
        <div className="mt-1.5 h-1.5 w-24 overflow-hidden rounded-full bg-muted">
          <motion.div
            initial={{ width: '30%' }}
            animate={{ width: '87%' }}
            transition={{ duration: 1.6, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="h-full rounded-full bg-primary"
          />
        </div>
      </motion.div>

      {/* Floating status pill — bottom */}
      <motion.div
        style={{ y: y3, opacity: fade }}
        className="absolute -bottom-5 left-10 z-20 flex items-center gap-2 rounded-full border border-border/60 bg-card/85 py-1.5 pl-2 pr-3.5 shadow-lg shadow-black/10 backdrop-blur-xl"
      >
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
        <span className="text-xs font-medium text-foreground">128 candidates online</span>
      </motion.div>
    </>
  );
}

export function LandingHero() {
  const reduce = useReducedMotion() ?? false;
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end start'],
  });

  // Scroll-aware motion
  const heroY = useTransform(scrollYProgress, [0, 1], [0, -80]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.6], [1, 0]);
  const glowY = useTransform(scrollYProgress, [0, 1], [0, 160]);
  const previewY = useTransform(scrollYProgress, [0, 1], [0, 60]);
  const previewRotate = useTransform(scrollYProgress, [0, 1], [0, 8]);
  const previewScale = useTransform(scrollYProgress, [0, 0.7], [1, 0.9]);
  const previewBlurVal = useTransform(scrollYProgress, [0.4, 1], [0, 10]);
  const previewBlur = useMotionTemplate`blur(${previewBlurVal}px)`;

  // Cursor-follow glass reflection
  const mx = useMotionValue(50);
  const my = useMotionValue(50);
  const reflectX = useSpring(mx, { stiffness: 60, damping: 20 });
  const reflectY = useSpring(my, { stiffness: 60, damping: 20 });
  const reflectBg = useTransform(
    [reflectX, reflectY],
    ([x, y]) =>
      `radial-gradient(420px circle at ${x}% ${y}%, hsl(var(--primary) / 0.12), transparent 70%)`,
  );

  return (
    <section
      ref={ref}
      id="home"
      className="relative overflow-hidden pb-24 pt-32 sm:pt-36 md:pb-32"
      onMouseMove={(e) => {
        if (reduce) return;
        const rect = e.currentTarget.getBoundingClientRect();
        mx.set(((e.clientX - rect.left) / rect.width) * 100);
        my.set(((e.clientY - rect.top) / rect.height) * 100);
      }}
    >
      {/* Background depth: grid + glow, moves slower */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-grid-fine [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,#000_60%,transparent_100%)] opacity-60" />
        <motion.div
          style={{ y: glowY }}
          className="absolute -top-40 left-1/2 h-[480px] w-[720px] -translate-x-1/2 rounded-full bg-primary/10 blur-[140px]"
        />
        <div className="absolute bottom-0 right-[-10%] h-72 w-72 rounded-full bg-accent/10 blur-[110px]" />
      </div>

      <div className="mx-auto grid max-w-6xl gap-12 px-5 sm:px-6 lg:grid-cols-[1fr_1.05fr] lg:items-center lg:gap-8">
        {/* LEFT — message */}
        <motion.div style={{ y: heroY, opacity: heroOpacity }} className="max-w-xl">
          <span className="eyebrow">
            <span className="eyebrow-dot" />
            Online examination platform
          </span>

          <h1 className="mt-6 text-[2.4rem] font-semibold leading-[1.08] tracking-tight text-foreground sm:text-[3rem] lg:text-[3.4rem]">
            Exams, managed{' '}
            <span className="text-transparent [background:linear-gradient(100deg,hsl(var(--foreground)),hsl(var(--accent)))] bg-clip-text">
              <TypingText text="intelligently." />
            </span>
          </h1>

          <p className="mt-5 max-w-md text-[0.98rem] leading-relaxed text-muted-foreground">
            A secure platform for <TypeCycler words={['students', 'instructors', 'administrators']} /> —
            from exam creation to live proctoring and instant results.
          </p>

          {/* Mode A — terminal typing (live system activity) */}
          <div className="mt-5 flex items-center gap-2 rounded-lg border border-border/50 bg-background/50 px-3 py-2 font-mono text-[0.7rem] text-muted-foreground backdrop-blur-sm">
            <TerminalSquare className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
            <span className="text-emerald-400">$</span>
            <TypeLoop
              phrases={['Initializing examination…', 'Session ready.', 'Proctoring online.']}
              typeMs={40}
              holdMs={1600}
              className="text-foreground/80"
            />
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/register"
              className="group inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:bg-primary/90 hover:shadow-primary/30 active:scale-[0.98]"
            >
              Start!
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="#lifecycle"
              className="group inline-flex items-center gap-2 rounded-xl border border-border bg-card/40 px-5 py-3 text-sm font-semibold text-foreground backdrop-blur-md transition-colors hover:bg-card/70"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              See how it works
            </Link>
          </div>

          <div className="mt-9 flex items-center gap-6 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <ScrambleText text="Browser lockdown" />
            </div>
            <div className="flex items-center gap-2">
              <Radio className="h-4 w-4 text-primary" />
              <MaskedReveal text="Live monitoring" />
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-accent" />
              Auto-graded
            </div>
          </div>
        </motion.div>

        {/* RIGHT — interactive glass exam interface */}
        <motion.div style={{ y: previewY, rotate: previewRotate, scale: previewScale, filter: previewBlur }} className="relative">
          <div className="relative mx-auto max-w-lg lg:max-w-none">
            {/* Cursor-follow reflection layer */}
            <motion.div
              className="pointer-events-none absolute -inset-6 -z-10 rounded-[2rem] opacity-60"
              style={{ background: reflectBg }}
            />

            {/* Orbital education objects around the product UI */}
            <OrbitObjects
              objects={[
                <div key="pencil" className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/50 bg-card/80 shadow-lg shadow-black/5 backdrop-blur" aria-hidden>
                  <Pencil className="h-5 w-5" />
                </div>,
                <div key="book" className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/50 bg-card/80 shadow-lg shadow-black/5 backdrop-blur" aria-hidden>
                  <Book className="h-5 w-5" />
                </div>,
                <div key="timer" className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/50 bg-card/80 shadow-lg shadow-black/5 backdrop-blur" aria-hidden>
                  <TimerObject className="h-5 w-5" />
                </div>,
                <div key="webcam" className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/50 bg-card/80 shadow-lg shadow-black/5 backdrop-blur" aria-hidden>
                  <Webcam className="h-5 w-5" />
                </div>,
                <div key="cert" className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/50 bg-card/80 shadow-lg shadow-black/5 backdrop-blur" aria-hidden>
                  <Certificate className="h-5 w-5" />
                </div>,
              ]}
            />

            {/* Main exam window */}
            <motion.div
              initial={reduce ? false : { opacity: 0, y: 40, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: MOTION.hero, delay: 0.2, ease: MOTION.ease }}
              className="glass-panel glass-edge overflow-hidden rounded-2xl"
            >
              {/* Window bar */}
              <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
                <div className="flex gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-[hsl(var(--destructive)/0.6)]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-400/60" />
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/60" />
                </div>
                <p className="font-mono text-[0.65rem] text-muted-foreground">exam · cs302</p>
                <span className="flex items-center gap-1.5 text-[0.65rem] font-medium text-emerald-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Secure
                </span>
              </div>

              {/* Body */}
              <div className="grid grid-cols-[1fr_auto] gap-4 p-4 sm:p-5">
                {/* Question area */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[0.65rem] font-semibold text-primary">
                      Question 4 of 20
                    </span>
                    <span className="flex items-center gap-1 text-[0.65rem] font-medium text-muted-foreground">
                      <Clock3 className="h-3.5 w-3.5 text-amber-500" />
                      24:18
                    </span>
                  </div>

                  <p className="text-[0.85rem] font-medium leading-snug text-foreground">
                    Which constraint ensures all values in a column are unique?
                  </p>

                  <div className="space-y-1.5">
                    {['PRIMARY KEY', 'UNIQUE', 'FOREIGN KEY', 'CHECK'].map((opt, i) => (
                      <div
                        key={opt}
                        className={
                          i === 1
                            ? 'flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-xs font-medium text-foreground'
                            : 'flex items-center gap-2 rounded-lg border border-border/60 bg-card/40 px-3 py-2 text-xs text-muted-foreground'
                        }
                      >
                        <span
                          className={
                            i === 1
                              ? 'flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[0.55rem] text-primary-foreground'
                              : 'flex h-4 w-4 items-center justify-center rounded-full border border-border text-[0.55rem]'
                          }
                        >
                          {String.fromCharCode(65 + i)}
                        </span>
                        {opt}
                      </div>
                    ))}
                  </div>

                  {/* Question progress dots */}
                  <div className="flex gap-1 pt-1">
                    {Array.from({ length: 10 }).map((_, i) => (
                      <span
                        key={i}
                        className={
                          i < 4
                            ? 'h-1.5 flex-1 rounded-full bg-primary'
                            : 'h-1.5 flex-1 rounded-full bg-border/70'
                        }
                      />
                    ))}
                  </div>
                </div>

                {/* Side rail */}
                <div className="flex flex-col justify-between gap-3 border-l border-border/50 pl-4">
                  <div>
                    <p className="text-[0.6rem] font-medium uppercase tracking-wide text-muted-foreground">
                      Session
                    </p>
                    <p className="text-lg font-semibold leading-none text-foreground">128</p>
                  </div>
                  <div className="flex flex-col items-center gap-1.5">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-500">
                      <CheckCircle2 className="h-4 w-4" />
                    </span>
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/15 text-amber-500">
                      <AlertTriangle className="h-4 w-4" />
                    </span>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between border-t border-border/60 px-4 py-2.5">
                <span className="text-[0.65rem] text-muted-foreground">Auto-saved · 0 violations</span>
                <span className="rounded-lg bg-primary px-3 py-1.5 text-[0.7rem] font-semibold text-primary-foreground">
                  Submit exam
                </span>
              </div>
            </motion.div>

            {/* Overlapping layered cards behind */}
            <div className="pointer-events-none absolute -right-6 -top-6 -z-10 hidden h-40 w-40 rounded-2xl border border-border/40 bg-card/40 blur-[1px] backdrop-blur-xl lg:block" />
            <div className="pointer-events-none absolute -bottom-8 -left-8 -z-10 hidden h-44 w-44 rounded-2xl border border-border/40 bg-card/30 backdrop-blur-xl lg:block" />

            <FloatingCards progress={scrollYProgress} />
          </div>
        </motion.div>
      </div>
    </section>
  );
}

