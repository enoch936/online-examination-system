'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';

/* =========================================================================
   Landing art — premium abstract education-tech scenes built as inline SVG
   + layered gradients. Server-rendered, zero assets, fully theme-aware.

   NetworkOrb  — a constellation of nodes & arcs for tech/analytics backdrops
   ScanRings   — radar/scanning rings for proctoring & security scenes
   AuroraBand  — a soft atmospheric gradient field for full-bleed backdrops
   HashPanel   — a stylized glass "image" card with a floating gradient grid
   ========================================================================= */

/* ------------------------- Network constellation ------------------------- */
export function NetworkOrb({ className }: { className?: string }) {
  const reduce = useReducedMotion() ?? false;
  const nodes: Array<[number, number, number]> = [
    [120, 40, 3.5],
    [60, 90, 2.5],
    [170, 70, 3],
    [30, 160, 2.5],
    [150, 145, 3.5],
    [95, 175, 2.5],
    [190, 180, 3],
    [210, 110, 2.5],
  ];
  const links: Array<[number, number, number, number]> = [
    [60, 90, 120, 40],
    [120, 40, 170, 70],
    [60, 90, 30, 160],
    [30, 160, 95, 175],
    [95, 175, 150, 145],
    [170, 70, 150, 145],
    [150, 145, 190, 180],
    [120, 40, 150, 145],
    [210, 110, 190, 180],
    [170, 70, 210, 110],
  ];
  return (
    <svg
      viewBox="0 0 240 220"
      className={cn('h-40 w-44 text-primary', className)}
      aria-hidden
      role="img"
      aria-label="Network constellation"
    >
      {links.map(([x1, y1, x2, y2], i) => (
        <motion.line
          key={i}
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke="currentColor"
          strokeOpacity="0.35"
          strokeDasharray="3 5"
          initial={reduce ? false : { pathLength: 0 }}
          animate={reduce ? undefined : { pathLength: 1 }}
          transition={{ duration: 1.4, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
        />
      ))}
      {nodes.map(([cx, cy, r], i) => (
        <motion.circle
          key={i}
          cx={cx}
          cy={cy}
          r={r}
          fill="hsl(var(--primary) / 0.8)"
          animate={reduce ? undefined : { opacity: [1, 0.35, 1], r: [r, r * 1.5, r] }}
          transition={{ duration: 3 + i * 0.35, repeat: Infinity, ease: 'easeInOut', delay: i * 0.2 }}
        />
      ))}
      <circle cx="120" cy="40" r="5.5" fill="hsl(var(--gold))" />
    </svg>
  );
}

/* ------------------------- Radar / scanning rings ------------------------- */
export function ScanRings({ className }: { className?: string }) {
  const reduce = useReducedMotion() ?? false;
  return (
    <svg
      viewBox="0 0 260 260"
      className={cn('h-52 w-52 text-emerald-500', className)}
      aria-hidden
      role="img"
      aria-label="Scanning rings"
    >
      {[26, 52, 78, 104].map((r, i) => (
        <motion.circle
          key={r}
          cx="130"
          cy="130"
          r={r}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.28 - i * 0.05}
          initial={reduce ? false : { scale: 0.6, opacity: 0 }}
          animate={reduce ? undefined : { scale: 1, opacity: [0.22, 0.4, 0.22] }}
          transition={{ duration: 2.6 + i * 0.7, repeat: Infinity, ease: 'easeInOut', delay: i * 0.5 }}
          style={{ transformOrigin: '130px 130px' }}
        />
      ))}
      <motion.circle
        cx="130"
        cy="130"
        r="104"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.4"
        strokeDasharray="10 14"
        animate={reduce ? undefined : { rotate: 360 }}
        transition={{ duration: 26, repeat: Infinity, ease: 'linear' }}
        style={{ transformOrigin: '130px 130px' }}
      />
      <motion.line
        x1="130"
        y1="130"
        x2="130"
        y2="34"
        stroke="hsl(var(--gold))"
        strokeOpacity="0.9"
        strokeWidth="1.5"
        animate={reduce ? undefined : { rotate: 360 }}
        transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
        style={{ transformOrigin: '130px 130px' }}
      />
      <motion.circle
        cx="176"
        cy="96"
        r="4"
        fill="hsl(var(--gold))"
        animate={reduce ? undefined : { r: [4, 6, 4], opacity: [1, 0.5, 1] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.circle
        cx="130"
        cy="130"
        r="3.5"
        fill="currentColor"
        animate={reduce ? undefined : { opacity: [1, 0.4, 1] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      />
    </svg>
  );
}

/* ------------------------- Atmospheric aurora band ------------------------- */
export function AuroraBand({ className }: { className?: string }) {
  const reduce = useReducedMotion() ?? false;
  return (
    <div
      className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}
      aria-hidden
      role="img"
      aria-label="Atmospheric gradient field"
    >
      <motion.div
        className="absolute -top-32 left-1/4 h-[420px] w-[620px] rounded-full bg-primary/15 blur-3xl"
        animate={reduce ? undefined : { x: [0, 40, 0], y: [0, -24, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute -bottom-24 right-1/5 h-[380px] w-[520px] rounded-full bg-gold/12 blur-3xl"
        animate={reduce ? undefined : { x: [0, -36, 0], y: [0, 28, 0] }}
        transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut', delay: 3 }}
      />
      <motion.div
        className="absolute left-1/2 top-1/2 h-[300px] w-[300px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/10 blur-3xl"
        animate={reduce ? undefined : { scale: [1, 1.18, 1], opacity: [0.7, 1, 0.7] }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
      />
      <div className="absolute inset-0 bg-grid-fine [mask-image:radial-gradient(ellipse_60%_60%_at_50%_50%,#000_30%,transparent_100%)] opacity-25" />
    </div>
  );
}

/* ------------------------- Stylized glass image panel ------------------------- */
export function HashPanel({
  className,
  tint = 'primary',
  children,
}: {
  className?: string;
  tint?: 'primary' | 'gold';
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border border-border/60 bg-card/40 backdrop-blur-xl',
        className,
      )}
      role="img"
      aria-label="Abstract data visualization"
    >
      <div
        className={cn(
          'absolute inset-0 bg-gradient-to-br opacity-30',
          tint === 'gold'
            ? 'from-gold/40 via-transparent to-primary/25'
            : 'from-primary/35 via-transparent to-accent/20',
        )}
      />
      <div className="absolute inset-0 bg-dots [mask-image:linear-gradient(to_bottom_right,#000_10%,transparent_70%)] opacity-40" />
      <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-gold/10 blur-[70px]" />
      <div className="absolute inset-0 bg-grid-fine [mask-image:radial-gradient(ellipse_70%_70%_at_30%_20%,#000_20%,transparent_90%)] opacity-30" />
      {children}
    </div>
  );
}