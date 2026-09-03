'use client';

import { motion, useReducedMotion } from 'framer-motion';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/* =========================================================================
   Lightweight 3D-style education objects — pure SVG + CSS, no WebGL.
   Each object is a small staged composition with its own entrance.
   ========================================================================= */

function useIdleFloat(reduce: boolean, enabled: boolean, amplitude = 6) {
  if (reduce || !enabled) return undefined;
  return {
    animate: { y: [0, -amplitude, 0], rotate: [0, -2, 0] },
    transition: { duration: 6, repeat: Infinity, ease: 'easeInOut' as const },
  };
}

/* ------------------------- Pencil (writing) ------------------------- */
export function Pencil({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={cn('h-10 w-10', className)} aria-hidden>
      <rect x="18" y="4" width="5" height="22" rx="1.5" fill="hsl(38 92% 50%)" />
      <rect x="18" y="4" width="5" height="7" fill="hsl(var(--foreground) / 0.85)" />
      <polygon points="20.5,28 17,32.5 24,32.5" fill="hsl(32 95% 44%)" />
      <circle cx="20.5" cy="33.5" r="1.6" fill="hsl(var(--foreground) / 0.6)" />
    </svg>
  );
}

/* ------------------------- Open book ------------------------- */
export function Book({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 32" className={cn('h-9 w-12', className)} aria-hidden>
      <path
        d="M24 6 C20 3 13 3 7 5 L7 26 C13 24 20 25 24 27 Z"
        fill="hsl(var(--primary) / 0.2)"
        stroke="hsl(var(--primary) / 0.6)"
        strokeWidth="1"
      />
      <path
        d="M24 6 C28 3 35 3 41 5 L41 26 C35 24 28 25 24 27 Z"
        fill="hsl(var(--accent) / 0.2)"
        stroke="hsl(var(--accent) / 0.6)"
        strokeWidth="1"
      />
      <path d="M24 6 L24 27" stroke="hsl(var(--foreground) / 0.3)" strokeWidth="1" />
    </svg>
  );
}

/* ------------------------- Digital timer / clock ------------------------- */
export function TimerObject({ className }: { className?: string }) {
  const reduce = useReducedMotion() ?? false;
  const float = useIdleFloat(reduce ?? false, true, 5);
  return (
    <motion.svg
      viewBox="0 0 40 40"
      className={cn('h-10 w-10', className)}
      aria-hidden
      {...(float as object)}
    >
      <circle cx="20" cy="21" r="12" fill="none" stroke="hsl(var(--foreground) / 0.4)" strokeWidth="1.5" />
      {!reduce && (
        <g>
          <motion.line
            x1="20" y1="21" x2="20" y2="13"
            stroke="hsl(var(--primary))" strokeWidth="1.5" strokeLinecap="round"
            animate={{ rotate: [0, 360] }}
            transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
            style={{ transformOrigin: '20px 21px' }}
          />
          <motion.line
            x1="20" y1="21" x2="28" y2="21"
            stroke="hsl(38 92% 50%)" strokeWidth="1.5" strokeLinecap="round"
            animate={{ rotate: [0, 360] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
            style={{ transformOrigin: '20px 21px' }}
          />
        </g>
      )}
      <rect x="15" y="4" width="10" height="3" rx="1.5" fill="hsl(var(--foreground) / 0.3)" />
    </motion.svg>
  );
}

/* ------------------------- Webcam ------------------------- */
export function Webcam({ className }: { className?: string }) {
  const reduce = useReducedMotion() ?? false;
  return (
    <svg viewBox="0 0 40 32" className={cn('h-8 w-10', className)} aria-hidden>
      <rect x="2" y="8" width="22" height="16" rx="3" fill="hsl(var(--foreground) / 0.1)" stroke="hsl(var(--foreground) / 0.4)" />
      <circle cx="13" cy="16" r="4.5" fill="none" stroke="hsl(var(--foreground) / 0.5)" />
      <circle cx="13" cy="16" r="2" fill="hsl(var(--primary))">
        {!reduce && (
          <animate attributeName="opacity" values="1;0.3;1" dur="3s" repeatCount="indefinite" />
        )}
      </circle>
      <path d="M24 12 L36 7 L36 25 L24 22 Z" fill="hsl(var(--foreground) / 0.15)" stroke="hsl(var(--foreground) / 0.3)" />
      <rect x="10" y="28" width="6" height="3" rx="1" fill="hsl(var(--foreground) / 0.3)" />
    </svg>
  );
}

/* ------------------------- Shield ------------------------- */
export function Shield({ className }: { className?: string }) {
  const reduce = useReducedMotion() ?? false;
  const float = useIdleFloat(reduce ?? false, true, 4);
  return (
    <motion.svg viewBox="0 0 32 36" className={cn('h-9 w-8', className)} aria-hidden {...(float as object)}>
      {!reduce && (
        <motion.path
          d="M16 2 L28 7 V18 C28 27 22 32 16 34 C10 32 4 27 4 18 V7 Z"
          fill="hsl(var(--primary) / 0.16)"
          stroke="hsl(var(--primary) / 0.6)"
          animate={{ opacity: [1, 0.6, 1] }}
          transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
      {reduce && (
        <path
          d="M16 2 L28 7 V18 C28 27 22 32 16 34 C10 32 4 27 4 18 V7 Z"
          fill="hsl(var(--primary) / 0.16)"
          stroke="hsl(var(--primary) / 0.6)"
        />
      )}
      <path d="M16 11 L21 13 L20 19 L16 21 L12 19 L11 13 Z" fill="hsl(var(--primary) / 0.9)" />
    </motion.svg>
  );
}

/* ------------------------- Certificate ------------------------- */
export function Certificate({ className }: { className?: string }) {
  const reduce = useReducedMotion() ?? false;
  const float = useIdleFloat(reduce ?? false, true, 5);
  return (
    <motion.svg viewBox="0 0 32 40" className={cn('h-10 w-8', className)} aria-hidden {...(float as object)}>
      <rect x="4" y="2" width="24" height="32" rx="2" fill="hsl(var(--card))" stroke="hsl(var(--foreground) / 0.3)" />
      <rect x="8" y="8" width="16" height="3" rx="1.5" fill="hsl(var(--primary) / 0.5)" />
      <rect x="8" y="14" width="12" height="2" rx="1" fill="hsl(var(--foreground) / 0.2)" />
      <rect x="8" y="18" width="16" height="8" rx="1.5" fill="hsl(var(--foreground) / 0.06)" />
      <g>
        <circle cx="16" cy="22" r="7" fill="none" stroke="hsl(38 92% 50% / 0.8)" strokeWidth="1.5" />
        <rect x="18" y="4" width="1.6" height="6" rx="0.8" fill="hsl(38 92% 50%)" />
      </g>
    </motion.svg>
  );
}

/* ------------------------- Exam paper ------------------------- */
export function Paper({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 36" className={cn('h-9 w-7', className)} aria-hidden>
      <rect x="2" y="3" width="24" height="30" rx="1.5" fill="hsl(var(--card))" stroke="hsl(var(--foreground) / 0.3)" />
      <rect x="6" y="9" width="16" height="2.4" rx="1.2" fill="hsl(var(--foreground) / 0.25)" />
      <rect x="6" y="14" width="12" height="2" rx="1" fill="hsl(var(--foreground) / 0.15)" />
      <rect x="6" y="19" width="16" height="2" rx="1" fill="hsl(var(--foreground) / 0.15)" />
      <rect x="6" y="24" width="10" height="2" rx="1" fill="hsl(var(--foreground) / 0.15)" />
    </svg>
  );
}

/* ------------------------- Notebook ------------------------- */
export function Notebook({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 34 40" className={cn('h-10 w-8', className)} aria-hidden>
      <rect x="6" y="2" width="22" height="34" rx="2" fill="hsl(var(--card))" stroke="hsl(var(--foreground) / 0.3)" />
      <line x1="20" y1="2" x2="20" y2="36" stroke="hsl(var(--primary) / 0.4)" strokeWidth="1" />
      <rect x="9" y="8" width="8" height="2" rx="1" fill="hsl(var(--foreground) / 0.2)" />
      <rect x="9" y="13" width="8" height="2" rx="1" fill="hsl(var(--foreground) / 0.2)" />
      <rect x="9" y="18" width="8" height="2" rx="1" fill="hsl(var(--foreground) / 0.2)" />
      <rect x="23" y="8" width="3" height="18" rx="1.5" fill="hsl(var(--primary) / 0.4)" />
    </svg>
  );
}

/* ------------------------- Smartboard ------------------------- */
export function Smartboard({ className }: { className?: string }) {
  const reduce = useReducedMotion() ?? false;
  return (
    <svg viewBox="0 0 48 30" className={cn('h-8 w-12', className)} aria-hidden>
      <rect x="2" y="2" width="44" height="24" rx="2" fill="hsl(var(--foreground) / 0.06)" stroke="hsl(var(--foreground) / 0.35)" />
      <g>
        <motion.line
          x1="8" y1="10" x2="24" y2="10"
          stroke="hsl(var(--primary))" strokeWidth="1.6" strokeLinecap="round"
          initial={reduce ? false : { pathLength: 0 }}
          animate={reduce ? undefined : { pathLength: 1 }}
          transition={{ duration: 1.2, delay: 0.3, ease: 'easeInOut' }}
        />
        <motion.circle
          cx="30" cy="18" r="0.1" fill="hsl(var(--accent))"
          animate={reduce ? undefined : { r: [0.1, 3, 0.1], opacity: [1, 0.6, 1] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
        />
      </g>
      <rect x="18" y="26" width="12" height="3" rx="1" fill="hsl(var(--foreground) / 0.25)" />
    </svg>
  );
}

/* ------------------------- Orbiting Objects ------------------------- */
export function OrbitObjects({
  objects,
  radius = 96,
  className,
}: {
  objects: ReactNode[];
  radius?: number;
  className?: string;
}) {
  const reduce = useReducedMotion() ?? false;
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const items = objects.map((node, i) => {
    const angle = (i / objects.length) * 360;
    const radians = (angle * Math.PI) / 180;
    const startX = Math.cos(radians) * radius;
    const startY = Math.sin(radians) * radius;
    const dir = i % 2 === 0 ? 1 : -1;
    return { node, startX, startY, dir };
  });

  return (
    <div className={cn('pointer-events-none absolute inset-0', className)} aria-hidden>
      {!mounted
        ? items.map(({ node }, i) => (
            <div
              key={i}
              className="absolute left-1/2 top-1/2 -mt-4 -ml-4 opacity-0"
              style={{ transform: `translate(0px, 0px)` }}
            >
              {node}
            </div>
          ))
        : items.map(({ node, startX, startY, dir }, i) =>
            reduce ? (
              <div
                key={i}
                className="absolute left-1/2 top-1/2 -mt-4 -ml-4"
                style={{ transform: `translate3d(${startX}px, ${startY}px, 0px)` }}
              >
                {node}
              </div>
            ) : (
              <motion.div
                key={i}
                className="absolute left-1/2 top-1/2"
                initial={reduce ? { x: 0, y: 0, opacity: 1 } : { x: startX, y: startY, opacity: 0, scale: 0.6 }}
                animate={{ x: startX, y: startY, opacity: 1, scale: 1 }}
                transition={{ duration: 1, delay: 0.6 + i * 0.12, ease: [0.16, 1, 0.3, 1] }}
                style={{ marginLeft: -16, marginTop: -16 }}
              >
                <motion.div
                  animate={{ x: [0, dir * 6, 0], y: [0, -6, 0] }}
                  transition={{ duration: 5 + i, repeat: Infinity, ease: 'easeInOut', delay: i * 0.4 }}
                >
                  {node}
                </motion.div>
              </motion.div>
            ),
          )}
    </div>
  );
}