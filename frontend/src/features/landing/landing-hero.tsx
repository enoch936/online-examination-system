'use client';

import Link from 'next/link';
import { useRef, useState, useEffect, type ReactNode } from 'react';
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
import {
  ArrowRight,
  Play,
  ShieldCheck,
  Clock3,
  CheckCircle2,
  AlertTriangle,
  TerminalSquare,
  Lock,
  Activity,
  Wifi,
} from 'lucide-react';
import { TypingText, TypeLoop, ScrambleText, MaskedReveal, WrapUpText, MOTION } from './landing-primitives';
import { TypeCycler } from './landing-typewriter';
import { OrbitObjects, Pencil, Book, TimerObject, Webcam, Certificate } from './landing-objects';
import { NetworkOrb } from './landing-art';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/* Magnetic — subtle pointer-follow for CTAs (desktop only)            */
/* ------------------------------------------------------------------ */
function Magnetic({ children, strength = 6 }: { children: ReactNode; strength?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion() ?? false;
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 150, damping: 16 });
  const sy = useSpring(y, { stiffness: 150, damping: 16 });

  return (
    <motion.div
      ref={ref}
      style={reduce ? undefined : { x: sx, y: sy }}
      onMouseMove={(e) => {
        if (reduce) return;
        const r = ref.current?.getBoundingClientRect();
        if (!r) return;
        x.set(((e.clientX - r.left) / r.width - 0.5) * strength);
        y.set(((e.clientY - r.top) / r.height - 0.5) * strength);
      }}
      onMouseLeave={() => {
        x.set(0);
        y.set(0);
      }}
      className="inline-block"
    >
      {children}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* FloatingCards — decorative parallax chips                           */
/* ------------------------------------------------------------------ */
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
        className="absolute -left-6 top-6 z-20 hidden rounded-2xl border border-border/60 bg-card/85 p-3 shadow-xl shadow-black/10 backdrop-blur-xl sm:block"
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

      {/* Floating sync card — top right */}
      <motion.div
        style={{ y: y2, opacity: fade }}
        className="absolute -right-4 -top-10 z-20 hidden rounded-2xl border border-border/60 bg-card/85 p-3 shadow-xl shadow-black/10 backdrop-blur-xl sm:block"
      >
        <p className="text-[0.65rem] font-medium text-muted-foreground">Session progress</p>
        <div className="flex items-end gap-1.5">
          <span className="text-xl font-semibold tracking-tight text-foreground">Q 4</span>
          <span className="mb-0.5 text-xs text-gold-strong">/ 20</span>
        </div>
        <div className="mt-1.5 h-1.5 w-24 overflow-hidden rounded-full bg-muted">
          <motion.div
            initial={{ width: '30%' }}
            animate={{ width: '20%' }}
            transition={{ duration: 1.6, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="h-full rounded-full bg-gold"
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
        <span className="text-xs font-medium text-foreground">Live session · synced</span>
      </motion.div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* LiveExamPanel — a real-time, ticking examination surface            */
/* ------------------------------------------------------------------ */
const feedPool = [
  'cs-284 · identity verified',
  'cs-301 · submitted Q7',
  'cs-266 · flagged: tab switch',
  'cs-273 · entered fullscreen',
  'cs-258 · autosave synced',
  'cs-290 · session resumed',
  'cs-277 · flagged: face occluded',
  'cs-302 · submitted exam',
];

function formatTime(total: number) {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function LiveExamPanel({ tick, reduce }: { tick: number; reduce: boolean }) {
  const total = 1500;
  const secondsLeft = reduce ? 1458 : Math.max(0, 1458 - tick);
  const candidates = reduce ? 128 : 128 + Math.round(Math.sin(tick / 6) * 4);
  const answered = reduce ? 4 : 4 + (tick % 20);
  const latency = reduce ? 24 : 18 + (tick % 9);
  const feed = reduce
    ? feedPool.slice(0, 3)
    : [0, 1, 2].map((i) => feedPool[(tick * 2 + i) % feedPool.length]);

  return (
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
        <span className="flex items-center gap-1.5 rounded-full border border-gold/30 bg-gold/10 px-2 py-0.5 text-[0.65rem] font-medium text-gold-strong">
          <Lock className="h-2.5 w-2.5" />
          Secure
        </span>
      </div>

      {/* Body */}
      <div className="grid grid-cols-[1fr_auto] gap-4 p-4 sm:p-5">
        {/* Question area */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[0.65rem] font-semibold text-primary">
              Question {Math.min(20, answered)} of 20
            </span>
            <span className="flex items-center gap-1 text-[0.65rem] font-medium text-muted-foreground tabular-nums">
              <Clock3 className="h-3.5 w-3.5 text-amber-500" />
              {formatTime(secondsLeft)}
            </span>
          </div>

          <p className="text-[0.85rem] font-medium leading-snug text-foreground">
            Which constraint ensures all values in a column are unique?
          </p>

          <div className="space-y-1.5">
            {['PRIMARY KEY', 'UNIQUE', 'FOREIGN KEY', 'CHECK'].map((opt, i) => {
              const selected = !reduce && i === answered % 4;
              return (
                <div
                  key={opt}
                  className={cn(
                    'flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs',
                    selected
                      ? 'border-primary/40 bg-primary/10 font-medium text-foreground'
                      : 'border-border/60 bg-card/40 text-muted-foreground',
                  )}
                >
                  <span className="flex items-center gap-2">
                    <span
                      className={cn(
                        'flex h-4 w-4 items-center justify-center rounded-full text-[0.55rem]',
                        selected
                          ? 'bg-primary text-primary-foreground'
                          : 'border border-border',
                      )}
                    >
                      {String.fromCharCode(65 + i)}
                    </span>
                    {opt}
                  </span>
                  {selected && <CheckCircle2 className="h-3.5 w-3.5 text-primary" />}
                </div>
              );
            })}
          </div>

          {/* Question progress dots */}
          <div className="flex gap-1 pt-1">
            {Array.from({ length: 10 }).map((_, i) => (
              <span
                key={i}
                className={cn(
                  'h-1.5 flex-1 rounded-full transition-colors duration-300',
                  i < Math.round(answered / 2) ? 'bg-gold' : i === Math.round(answered / 2) ? 'bg-gold/50' : 'bg-border/70',
                )}
              />
            ))}
          </div>
        </div>

        {/* Side rail */}
        <div className="flex flex-col justify-between gap-3 border-l border-border/50 pl-4">
          <div>
            <p className="text-[0.6rem] font-medium uppercase tracking-wide text-muted-foreground">Candidates</p>
            <p className="text-lg font-semibold leading-none text-foreground tabular-nums">{candidates}</p>
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <span className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-500">
              <CheckCircle2 className="h-4 w-4" />
              {!reduce && (
                <span className="absolute -right-1 -top-1 flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
              )}
            </span>
            <span className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/15 text-amber-500">
              <AlertTriangle className="h-4 w-4" />
              {!reduce && (
                <span className="absolute -right-1 -top-1 flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
                </span>
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Live proctoring feed */}
      <div className="border-t border-border/60 px-4 pb-3 pt-2.5">
        <div className="flex items-center justify-between">
          <p className="text-[0.6rem] font-semibold uppercase tracking-wide text-muted-foreground">Proctoring log</p>
          <span className="flex items-center gap-1 text-[0.6rem] font-medium text-emerald-400">
            <Wifi className="h-2.5 w-2.5" />
            {latency}ms
          </span>
        </div>
        <div className="mt-1.5 space-y-0.5">
          {feed.map((row) => {
            const flag = row.includes('flagged');
            return (
              <motion.p
                key={row}
                initial={reduce ? false : { opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4 }}
                className="flex items-center gap-1.5 font-mono text-[0.62rem] text-muted-foreground"
              >
                <span className={cn('h-1 w-1 shrink-0 rounded-full', flag ? 'bg-amber-500' : 'bg-emerald-500')} />
                <span className="truncate">{row}</span>
              </motion.p>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-border/60 px-4 py-2.5">
        <span className="text-[0.65rem] text-muted-foreground">Autosaved · 0 violations</span>
        <span className="glow-gold-soft rounded-lg bg-gradient-to-br from-gold-strong to-gold px-3 py-1.5 text-[0.7rem] font-semibold text-gold-foreground">
          Submit exam
        </span>
      </div>
    </motion.div>
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

  // Live heartbeat for the exam dashboard
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (reduce) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [reduce]);

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
      {/* Background depth: midnight navy aurora + masked grid */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-grid-fine [mask-image:radial-gradient(ellipse_70%_60%_at_50%_0%,#000_60%,transparent_100%)] opacity-60" />
        <motion.div
          style={{ y: glowY }}
          className="absolute -top-40 left-1/2 h-[480px] w-[720px] -translate-x-1/2 rounded-full bg-primary/10 blur-[140px]"
        />
        <div className="absolute right-[-6%] top-40 h-64 w-64 rounded-full bg-gold/10 blur-[120px]" />
        <div className="absolute bottom-0 left-[-8%] h-72 w-72 rounded-full bg-accent/10 blur-[110px]" />
        <NetworkOrb className="absolute bottom-10 left-0 hidden h-40 w-44 text-primary/30 md:block" />
      </div>

      <div className="mx-auto grid max-w-6xl gap-12 px-5 sm:px-6 lg:grid-cols-[1fr_1.05fr] lg:items-center lg:gap-8">
        {/* LEFT — message */}
        <motion.div style={{ y: heroY, opacity: heroOpacity }} className="max-w-xl">
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: MOTION.normal, ease: MOTION.ease }}
          >
            <span className="eyebrow">
              <span className="eyebrow-dot-gold" />
              Online examination platform
            </span>
          </motion.div>

          <h1 className="mt-6 text-[2.5rem] font-semibold leading-[1.05] tracking-[-0.03em] text-foreground sm:text-[3.2rem] lg:text-[3.7rem]">
            <WrapUpText lines={['Exams, managed']} delay={0.05} />
            <span className="block text-gold-gradient">
              <TypingText text="intelligently." />
            </span>
          </h1>

          <motion.p
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: MOTION.normal, delay: 0.25, ease: MOTION.ease }}
            className="mt-5 max-w-md text-[0.98rem] leading-relaxed text-muted-foreground"
          >
            A secure platform for <TypeCycler words={['students', 'instructors', 'administrators', 'proctors']} /> —
            from exam creation to live proctoring and instant results.
          </motion.p>

          {/* Mode A — terminal typing (live system activity) */}
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: MOTION.normal, delay: 0.35, ease: MOTION.ease }}
            className="mt-5 flex items-center gap-2 rounded-lg border border-border/50 bg-background/50 px-3 py-2 font-mono text-[0.7rem] text-muted-foreground backdrop-blur-sm"
          >
            <TerminalSquare className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
            <span className="text-gold-strong">$</span>
            <TypeLoop
              phrases={['Initializing examination…', 'Session ready.', 'Proctoring online.']}
              typeMs={40}
              holdMs={1600}
              className="text-foreground/80"
            />
          </motion.div>

          <motion.div
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: MOTION.normal, delay: 0.45, ease: MOTION.ease }}
            className="mt-8 flex flex-wrap items-center gap-3"
          >
            <Magnetic strength={7}>
              <Link
                href="/register"
                className="btn-shine group inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:bg-primary/90 hover:shadow-primary/30 active:scale-[0.98]"
              >
                Get started
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </Magnetic>
            <Magnetic strength={5}>
              <Link
                href="#lifecycle"
                className="group inline-flex items-center gap-2 rounded-xl border border-border bg-card/40 px-6 py-3 text-sm font-semibold text-foreground backdrop-blur-md transition-colors hover:bg-card/70"
              >
                <Play className="h-3.5 w-3.5 fill-current" />
                See how it works
              </Link>
            </Magnetic>
          </motion.div>

          <motion.div
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: MOTION.normal, delay: 0.6, ease: MOTION.ease }}
            className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground"
          >
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <ScrambleText text="Browser lockdown" />
            </div>
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-gold-strong" />
              <MaskedReveal text="Live monitoring" />
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-gold-strong" />
              Auto-graded
            </div>
          </motion.div>
        </motion.div>

        {/* RIGHT — live exam interface */}
        <motion.div
          style={{ y: previewY, rotate: previewRotate, scale: previewScale, filter: previewBlur }}
          className="relative"
        >
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
                <div key="cert" className="glow-gold flex h-9 w-9 items-center justify-center rounded-xl border border-gold/30 bg-card/80 shadow-lg shadow-black/5 backdrop-blur" aria-hidden>
                  <Certificate className="h-5 w-5" />
                </div>,
              ]}
            />

            {/* Main exam window */}
            <LiveExamPanel tick={tick} reduce={reduce} />

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