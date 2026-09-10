'use client';

import Image from 'next/image';
import { motion, useReducedMotion } from 'framer-motion';
import { GraduationCap, Code2, BookOpen } from 'lucide-react';
import { Reveal, SectionReveal, Parallax } from './landing-primitives';

const shots = [
  {
    id: 'photo-1523240795612-9a054b0db644',
    icon: GraduationCap,
    tag: 'Exams',
    label: 'Candidates in focus',
  },
  {
    id: 'photo-1498050108023-c5249f4df085',
    icon: Code2,
    tag: 'Technology',
    label: 'Built for real-time',
  },
  {
    id: 'photo-1507842217343-583bb7270b66',
    icon: BookOpen,
    tag: 'Learning',
    label: 'A library of questions',
  },
];

const strips = ['Identity checks', 'Autosave', 'Fullscreen lock', 'Instant grading', 'Live flags'];

export function LandingInterlude() {
  const reduce = useReducedMotion() ?? false;

  return (
    <SectionReveal mode="wipe-up" className="relative isolate py-20 md:py-28">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <Parallax speed={130} className="absolute -right-24 top-10 h-72 w-72 rounded-full bg-gold/8 blur-3xl" />
        <Parallax speed={60} className="absolute -left-24 bottom-10 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
      </div>

      <div className="mx-auto max-w-6xl px-5 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <Reveal style="fade-right">
            <span className="eyebrow">
              <span className="eyebrow-dot-gold" />
              Inside the platform
            </span>
            <h2 className="mt-5 text-[1.7rem] font-semibold leading-[1.15] tracking-tight text-foreground sm:text-3xl">
              One surface for every seat
            </h2>
          </Reveal>
          <Reveal style="none" delay={0.1}>
            <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
              From the first click to the final certificate, every moment of an exam is covered on a single
              live surface.
            </p>
          </Reveal>
        </div>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {shots.map((s, i) => {
            const Icon = s.icon;
            const style = (['rise-rotate', 'clip-up', 'swing'] as const)[i % 3];
            return (
              <Reveal key={s.id} style={style} delay={i * 0.12}>
                <Parallax speed={34 + i * 16}>
                  <div className="group relative aspect-[4/5] overflow-hidden rounded-2xl border border-border/60">
                    <Image
                      src={`https://images.unsplash.com/${s.id}?auto=format&fit=crop&w=1100&q=80`}
                      alt={s.label}
                      fill
                      sizes="(min-width: 768px) 33vw, 100vw"
                      className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.06]"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent" />
                    <div className="absolute inset-x-0 bottom-0 p-5">
                      <span className="flex w-fit items-center gap-1.5 rounded-full border border-border/60 bg-background/60 px-2.5 py-1 text-[0.62rem] font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur">
                        <Icon className="h-3 w-3 text-gold-strong" />
                        {s.tag}
                      </span>
                      <p className="mt-3 text-sm font-semibold tracking-tight text-foreground">{s.label}</p>
                    </div>
                    {!reduce && (
                      <div className="pointer-events-none absolute -inset-px rounded-2xl opacity-0 transition-opacity duration-500 group-hover:opacity-100 bg-[radial-gradient(420px_circle_at_50%_0%,hsl(var(--primary)/0.14),transparent_70%)]" />
                    )}
                  </div>
                </Parallax>
              </Reveal>
            );
          })}
        </div>

        <div className="mt-12 flex flex-wrap items-center justify-center gap-2">
          {strips.map((t, i) => (
            <motion.span
              key={t}
              initial={reduce ? false : { opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ delay: 0.25 + i * 0.06, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              className="rounded-full border border-border/60 bg-card/40 px-3.5 py-1.5 text-xs font-medium text-muted-foreground"
            >
              {t}
            </motion.span>
          ))}
        </div>
      </div>
    </SectionReveal>
  );
}