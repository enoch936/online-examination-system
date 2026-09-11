'use client';

import {
  motion,
  useMotionValue,
  useScroll,
  useSpring,
  useReducedMotion,
  useMotionTemplate,
  useTransform,
  type TargetAndTransition,
} from 'framer-motion';
import { useEffect, useRef, useState, type ReactNode, type MouseEvent, type HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import { api } from '@/services/api';

/* ------------------------------------------------------------------ */
/* Reveal — rich set of scroll-triggered entrance styles               */
/* ------------------------------------------------------------------ */
type RevealStyle =
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'scale'
  | 'blur'
  | 'zoom-up'
  | 'zoom-in'
  | 'pop'
  | 'circling'
  | 'spin-in'
  | 'flip-in'
  | 'drop-in'
  | 'fade-left'
  | 'fade-right'
  | 'diagonal-tr'
  | 'diagonal-bl'
  | 'perspective-in'
  | 'expand-out'
  | 'contract-in'
  | 'rise-rotate'
  | 'tumble-in'
  | 'swing'
  | 'clip-up'
  | 'blur-scale'
  | 'spiral'
  | 'none';

type RevealProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
  style?: RevealStyle;
  duration?: number;
  once?: boolean;
};

const EASE = [0.16, 1, 0.3, 1] as const;

/* ------------------------------------------------------------------ */
/* useRevealGate — scroll-driven reveal trigger with fallback.         */
/* Chromium's IntersectionObserver can stay permanently false for      */
/* elements nested under transformed/framer subtrees (the "reveals     */
/* never fire" bug that leaves content stuck at opacity 0 — full UI    */
/* only ever appears in Firefox). Instead of trusting IO, we watch the */
/* element's position on scroll. Whereas un re-animates every block    */
/* once, reversible mode keeps a section "on" while it is on screen    */
/* and animates it back out once it scrolls past — the in-and-out      */
/* scroll effect, deterministic in every browser.                      */
/* ------------------------------------------------------------------ */
export function useRevealGate(lead = 2.2, reversible = false) {
  const ref = useRef<HTMLElement | null>(null);
  const reduce = useReducedMotion() ?? false;
  const [forced, setForced] = useState(false);
  const [intersecting, setIntersecting] = useState(false);

  const shown = reduce ? true : reversible ? intersecting : forced;

  useEffect(() => {
    if (reduce) return;
    let raf = 0;
    const check = () => {
      raf = 0;
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (reversible) {
        const vh = window.innerHeight;
        setIntersecting(r.top < vh * 1.15 && r.bottom > vh * -0.05);
        return;
      }
      if (!forced && r.top - window.innerHeight * lead < 0) setForced(true);
    };
    const onScroll = () => {
      if (raf === 0) raf = requestAnimationFrame(check);
    };
    const first = requestAnimationFrame(check);
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      cancelAnimationFrame(first);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [reduce, reversible, forced, lead]);

  return { ref, shown, reduce };
}

export const MOTION = {
  fast: 0.18,
  normal: 0.35,
  smooth: 0.55,
  section: 0.75,
  hero: 1.0,
  ease: EASE,
} as const;

const STYLES: Record<RevealStyle, { initial: TargetAndTransition }> = {
  up: { initial: { opacity: 0, y: 32 } },
  down: { initial: { opacity: 0, y: -32 } },
  left: { initial: { opacity: 0, x: 44 } },
  right: { initial: { opacity: 0, x: -44 } },
  scale: { initial: { opacity: 0, scale: 0.94 } },
  blur: { initial: { opacity: 0, filter: 'blur(10px)', y: 14 } },
  'zoom-up': { initial: { opacity: 0, scale: 0.75, y: 48 } },
  'zoom-in': { initial: { opacity: 0, scale: 0.7 } },
  pop: { initial: { opacity: 0, scale: 0.5 } },
  circling: { initial: { opacity: 0, x: -60, y: -60, rotate: -12, scale: 0.9 } },
  'spin-in': { initial: { opacity: 0, rotate: -60, scale: 0.7 } },
  'flip-in': { initial: { opacity: 0, rotateX: -80, y: 20 } },
  'drop-in': { initial: { opacity: 0, y: -60 } },
  'fade-left': { initial: { opacity: 0, x: -70 } },
  'fade-right': { initial: { opacity: 0, x: 70 } },
  'diagonal-tr': { initial: { opacity: 0, x: 60, y: -60, scale: 0.94 } },
  'diagonal-bl': { initial: { opacity: 0, x: -60, y: 60, scale: 0.94 } },
  'perspective-in': { initial: { opacity: 0, scale: 0.9, z: -60, perspective: 900 } },
  'expand-out': { initial: { opacity: 0, clipPath: 'inset(0 0 100% 0)' } },
  'contract-in': { initial: { opacity: 0, clipPath: 'inset(0 100% 0 0)' } },
  'rise-rotate': { initial: { opacity: 0, y: 56, rotate: 4 } },
  'tumble-in': { initial: { opacity: 0, rotate: -8, y: 36, scale: 0.9 } },
  swing: { initial: { opacity: 0, x: 84, y: -32, rotate: -5 } },
  'clip-up': { initial: { opacity: 0, clipPath: 'inset(45% 0 45% 0)', y: 18 } },
  'blur-scale': { initial: { opacity: 0, filter: 'blur(8px)', scale: 1.08 } },
  spiral: { initial: { opacity: 0, x: 60, y: -60, rotate: 720, scale: 0.6 } },
  none: { initial: { opacity: 0 } },
};

export function Reveal({
  children,
  className,
  delay = 0,
  style = 'up',
  duration = 0.7,
  once = true,
}: RevealProps) {
  const { ref, shown, reduce } = useRevealGate();
  const s = STYLES[style];
  const target: TargetAndTransition = {
    opacity: 1,
    x: 0,
    y: 0,
    scale: 1,
    rotate: 0,
    rotateX: 0,
    filter: 'blur(0px)',
    z: 0,
    clipPath: 'inset(0 0 0 0)',
  };
  const hidden = reduce ? target : s.initial;

  return (
    <motion.div
      ref={ref as React.Ref<HTMLDivElement>}
      className={className}
      initial={reduce ? false : hidden}
      animate={shown ? target : hidden}
      transition={{ duration: reduce ? 0 : duration, delay: reduce ? 0 : delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* OverlapReveal — 2 layers slide from opposite directions & overlap   */
/* ------------------------------------------------------------------ */
export function OverlapReveal({
  children,
  className,
  delay = 0,
  from = 'right',
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  from?: 'left' | 'right';
}) {
  const { ref, shown, reduce } = useRevealGate();
  const dir = from === 'right' ? 1 : -1;
  const hidden: TargetAndTransition = { opacity: 0, x: dir * 60, scale: 0.96 };
  const target: TargetAndTransition = { opacity: 1, x: 0, scale: 1 };

  return (
    <motion.div
      ref={ref as React.Ref<HTMLDivElement>}
      className={className}
      initial={reduce ? false : hidden}
      animate={shown ? target : hidden}
      transition={{ duration: reduce ? 0 : 0.8, delay: reduce ? 0 : delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* WrapUpReveal — masked rising words (a “wrap-up” entrance)           */
/* Format: pass an array of lines; each line reveals word by word      */
/* ------------------------------------------------------------------ */
export function WrapUpText({
  lines,
  className,
  delay = 0,
  once = true,
}: {
  lines: ReactNode[];
  className?: string;
  delay?: number;
  once?: boolean;
}) {
  const { ref, shown, reduce } = useRevealGate();
  return (
    <span ref={ref as React.Ref<HTMLSpanElement>} className={className}>
      {lines.map((line, li) => (
        <span key={li} className="block overflow-hidden pb-[0.12em]">
          <motion.span
            className="block"
            initial={reduce ? false : { y: '110%', rotate: 4 }}
            animate={shown ? { y: '0%', rotate: 0 } : { y: '110%', rotate: 4 }}
            transition={{ duration: reduce ? 0 : 0.7, delay: reduce ? 0 : delay + li * 0.1, ease: [0.16, 1, 0.3, 1] }}
          >
            {line}
          </motion.span>
        </span>
      ))}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* TypingText — typewriter effect (started when scrolled into view)    */
/* ------------------------------------------------------------------ */
export function TypingText({
  text,
  className,
  speed = 45,
  startDelay = 0,
  caret = true,
}: {
  text: string;
  className?: string;
  speed?: number;
  startDelay?: number;
  caret?: boolean;
}) {
  const { ref, shown, reduce } = useRevealGate();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!shown || reduce) return;
    let i = 0;
    let raf = 0;
    let startedAt = 0;
    const tick = (now: number) => {
      if (!startedAt) startedAt = now;
      const elapsed = now - startedAt - startDelay;
      if (elapsed >= 0) {
        const step = Math.floor(elapsed / speed);
        i = Math.min(Math.max(step, i), text.length);
        setCount(i);
        if (i < text.length) raf = requestAnimationFrame(tick);
      } else {
        raf = requestAnimationFrame(tick);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [shown, reduce, text.length, speed, startDelay]);

  // Reduced motion: render the complete string immediately.
  const shownText = reduce ? text : text.slice(0, count);

  return (
    <span ref={ref as React.Ref<HTMLSpanElement>} className={className}>
      {shownText}
      {caret && !reduce && count < text.length && (
        <span className="ml-0.5 inline-block w-[0.12em] animate-pulse bg-current align-[-0.08em]" />
      )}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* TypeLoop — types, pauses, deletes, then types the next phrase.      */
/* Mode B/C/E of the multi-location typing system.                     */
/* ------------------------------------------------------------------ */
export function TypeLoop({
  phrases,
  className,
  typeMs = 55,
  deleteMs = 26,
  holdMs = 1400,
  caret = true,
  startDelay = 0,
}: {
  phrases: string[];
  className?: string;
  typeMs?: number;
  deleteMs?: number;
  holdMs?: number;
  caret?: boolean;
  startDelay?: number;
}) {
  const { ref, shown, reduce } = useRevealGate();

  const [text, setText] = useState('');
  const [phase, setPhase] = useState<'type' | 'hold' | 'delete'>('type');
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!shown || reduce || phrases.length === 0) return;
    let raf = 0;
    let startedAt = 0;
    let wait = startDelay;
    const word = () => phrases[index];

    const tick = (now: number) => {
      if (!startedAt) startedAt = now;
      const elapsed = now - startedAt;
      if (elapsed < wait) {
        raf = requestAnimationFrame(tick);
        return;
      }
      const full = word();
      if (phase === 'type') {
        setText(full.slice(0, text.length + 1));
        if (text.length + 1 >= full.length) {
          setPhase('hold');
          wait = holdMs;
        } else {
          wait = typeMs;
        }
      } else if (phase === 'hold') {
        setPhase('delete');
        wait = holdMs;
      } else {
        setText(full.slice(0, Math.max(0, text.length - 1)));
        if (text.length - 1 <= 0) {
          setIndex((i) => (i + 1) % phrases.length);
          setPhase('type');
          wait = typeMs;
        } else {
          wait = deleteMs;
        }
      }
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [shown, reduce, phrases, index, phase, text.length, typeMs, deleteMs, holdMs, startDelay]);

  const shownText = reduce ? phrases[0] ?? '' : text;

  return (
    <span ref={ref as React.Ref<HTMLSpanElement>} className={className}>
      {shownText}
      {caret && !reduce && (
        <span className="ml-0.5 inline-block w-[0.12em] animate-pulse bg-current align-[-0.08em]" />
      )}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* ScrambleText — characters scramble before resolving into the final  */
/* string. Used only for small labels (Mode G).                       */
/* ------------------------------------------------------------------ */
export function ScrambleText({
  text,
  className,
  duration = 600,
  startDelay = 0,
}: {
  text: string;
  className?: string;
  duration?: number;
  startDelay?: number;
}) {
  const { ref, shown, reduce } = useRevealGate();
  const [chars, setChars] = useState<{ c: string; done: boolean }[]>(() =>
    text.split('').map((c) => ({ c, done: false })),
  );

  useEffect(() => {
    if (!shown || reduce) return;
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/*+=<!> ';
    let frame = 0;
    let raf = 0;
    let startedAt = 0;
    const tick = (now: number) => {
      if (!startedAt) startedAt = now;
      const elapsed = now - startedAt - startDelay;
      if (elapsed < 0) {
        raf = requestAnimationFrame(tick);
        return;
      }
      frame++;
      setChars(
        text.split('').map((c, i) => {
          const resolveAt = (i / text.length) * duration;
          if (frame * 16 >= resolveAt) return { c, done: true };
          if (c === ' ') return { c: ' ', done: false };
          return { c: alphabet[Math.floor(Math.random() * alphabet.length)], done: false };
        }),
      );
      if (frame * 16 < duration) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [shown, reduce, text, duration, startDelay]);

  return (
    <span ref={ref as React.Ref<HTMLSpanElement>} className={className} aria-label={text}>
      {reduce ? text : chars.map((ch, i) => <span key={i} data-done={ch.done}>{ch.c}</span>)}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* MaskedReveal — text appears as if uncovered by a moving mask        */
/* (Mode H).                                                           */
/* ------------------------------------------------------------------ */
export function MaskedReveal({
  text,
  className,
  delay = 0,
}: {
  text: string;
  className?: string;
  delay?: number;
}) {
  const { ref, shown, reduce } = useRevealGate();
  return (
    <span ref={ref as React.Ref<HTMLSpanElement>} className={className} aria-label={text}>
      <span className="inline-block overflow-hidden align-bottom">
        <motion.span
          className="inline-block whitespace-pre"
          initial={reduce ? false : { clipPath: 'inset(0 100% 0 0)' }}
          animate={shown ? { clipPath: 'inset(0 0 0 0)' } : { clipPath: 'inset(0 100% 0 0)' }}
          transition={{ duration: reduce ? 0 : 0.7, delay: reduce ? 0 : delay, ease: EASE }}
        >
          {text}
        </motion.span>
      </span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* MagneticButton — primary CTA that subtly follows the pointer        */
/* ------------------------------------------------------------------ */
export function MagneticButton({
  children,
  className,
  strength = 8,
  onClick,
  type = 'button',
  disabled,
  'aria-label': ariaLabel,
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { strength?: number }) {
  const ref = useRef<HTMLButtonElement>(null);
  const reduce = useReducedMotion() ?? false;
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 160, damping: 18 });
  const sy = useSpring(y, { stiffness: 160, damping: 18 });

  return (
    <motion.button
      ref={ref}
      type={type}
      disabled={disabled}
      aria-label={ariaLabel}
      onClick={onClick}
      style={reduce ? undefined : { x: sx, y: sy }}
      onMouseMove={
        reduce
          ? undefined
          : (e) => {
              const el = ref.current;
              if (!el) return;
              const rect = el.getBoundingClientRect();
              x.set(((e.clientX - rect.left) / rect.width - 0.5) * strength);
              y.set(((e.clientY - rect.top) / rect.height - 0.5) * strength);
            }
      }
      onMouseLeave={() => {
        x.set(0);
        y.set(0);
      }}
      className={cn('active:scale-[0.97]', className)}
    >
      {children}
    </motion.button>
  );
}

/* ------------------------------------------------------------------ */
/* MorphContainer — animated shape transition between container        */
/* geometries (rounded rect -> wide dashboard -> panel).               */
/* ------------------------------------------------------------------ */
export function MorphContainer({
  children,
  className,
  from = 'pill',
  to = 'rounded',
  on = true,
}: {
  children: ReactNode;
  className?: string;
  from?: 'pill' | 'square' | 'rounded';
  to?: 'rounded' | 'wide' | 'pill';
  on?: boolean;
}) {
  const reduce = useReducedMotion() ?? false;
  const shapes = {
    pill: 'border-radius: 999px',
    square: 'border-radius: 0px',
    rounded: 'border-radius: 20px',
    wide: 'border-radius: 24px',
  } as const;
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { borderRadius: from === 'pill' ? 999 : from === 'square' ? 0 : 20 }}
      animate={
        on
          ? { borderRadius: to === 'wide' ? 24 : to === 'pill' ? 999 : 20 }
          : { borderRadius: from === 'pill' ? 999 : from === 'square' ? 0 : 20 }
      }
      transition={{ duration: 0.6, ease: EASE }}
      style={{ overflow: 'hidden' }}
    >
      {children}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* ScrollExit — fades/scales the block out as it scrolls past          */
/* (rotating disappearance / blur-out)                                 */
/* ------------------------------------------------------------------ */
export function ScrollExit({
  children,
  kind = 'fade',
  className,
}: {
  children: ReactNode;
  kind?: 'fade' | 'zoom' | 'rotate' | 'blur';
  className?: string;
}) {
  const { ref, shown, reduce } = useRevealGate(0);
  const gone = reduce ? false : !shown;

  const hidden = kind === 'zoom'
    ? { opacity: 0, scale: 0.85 }
    : kind === 'rotate'
      ? { opacity: 0, rotate: 14, scale: 0.92 }
      : kind === 'blur'
        ? { opacity: 0, filter: 'blur(12px)' }
        : { opacity: 0.2, y: 20 };
  const visible = { opacity: 1, scale: 1, rotate: 0, y: 0, filter: 'blur(0px)' };

  return (
    <motion.div
      ref={ref as React.Ref<HTMLDivElement>}
      className={className}
      initial={false}
      animate={gone ? hidden : visible}
      transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Section header — eyebrow + compact heading + optional subline       */
/* ------------------------------------------------------------------ */
export function SectionHeader({
  eyebrow,
  title,
  sub,
  align = 'center',
  reveal = 'none',
  className,
}: {
  eyebrow: string;
  title: ReactNode;
  sub?: string;
  align?: 'center' | 'left' | 'right';
  reveal?: RevealStyle;
  className?: string;
}) {
  return (
    <Reveal
      style={reveal}
      className={cn(
        'max-w-none',
        align === 'center' ? 'mx-auto text-center' : align === 'right' ? 'ml-auto text-right' : 'text-left',
        className,
      )}
    >
      <span className="eyebrow">
        <span className="eyebrow-dot" />
        {eyebrow}
      </span>
      <h2 className="mt-5 text-[1.7rem] font-semibold leading-[1.15] tracking-tight text-foreground sm:text-3xl">
        {title}
      </h2>
      {sub && <p className="mt-4 text-[0.95rem] leading-relaxed text-muted-foreground">{sub}</p>}
    </Reveal>
  );
}

/* ------------------------------------------------------------------ */
/* Parallax — scroll-linked vertical drift. Wrap decorative layers     */
/* with different `speed` values to create depth (background slow,     */
/* foreground fast). Disabled under prefers-reduced-motion.            */
/* ------------------------------------------------------------------ */
export function Parallax({
  children,
  className,
  speed = 60,
}: {
  children?: ReactNode;
  className?: string;
  speed?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion() ?? false;
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const y = useTransform(scrollYProgress, [0, 1], [speed, -speed]);

  if (reduce) {
    return (
      <div ref={ref} className={className}>
        {children}
      </div>
    );
  }

  return (
    <motion.div ref={ref} className={className} style={{ y }}>
      {children}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* SectionReveal — a deliberate entrance for each major section.      */
/* Each section wipes/lifts/expands into place as it scrolls in,      */
/* creating a visible transition between sections instead of a flat   */
/* stack. Reduced-motion renders the section plainly.                */
/* ------------------------------------------------------------------ */
export type SectionMode = 'wipe-up' | 'wipe-left' | 'expand-in' | 'rise-impact' | 'fade-scale';

export function SectionReveal({
  children,
  id,
  className,
  mode = 'wipe-up',
  onMouseEnter,
  onMouseLeave,
}: {
  children: ReactNode;
  id?: string;
  className?: string;
  mode?: SectionMode;
  onMouseEnter?: HTMLAttributes<HTMLElement>['onMouseEnter'];
  onMouseLeave?: HTMLAttributes<HTMLElement>['onMouseLeave'];
}) {
  const { ref, shown, reduce } = useRevealGate(2.2, true);

  const initial: TargetAndTransition =
    mode === 'wipe-left'
      ? { clipPath: 'inset(0 100% 0 0)' }
      : mode === 'expand-in'
        ? { clipPath: 'inset(42% 42% 42% 42%)', scale: 0.985 }
        : mode === 'rise-impact'
          ? { opacity: 0, y: 52, scale: 0.99 }
          : mode === 'fade-scale'
            ? { opacity: 0.35, scale: 0.985 }
            : { clipPath: 'inset(0 0 100% 0)' };

  const target: TargetAndTransition = { opacity: 1, y: 0, scale: 1, clipPath: 'inset(0 0 0 0)' };

  return (
    <motion.section
      ref={ref as React.Ref<HTMLElement>}
      id={id}
      className={className}
      initial={reduce ? false : initial}
      animate={shown ? target : initial}
      transition={{ duration: reduce ? 0 : 0.7, ease: EASE }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {children}
    </motion.section>
  );
}

/* ------------------------------------------------------------------ */
/* Counter — animated number that counts up when in view               */
/* ------------------------------------------------------------------ */
export function Counter({
  value,
  suffix = '',
  duration = 1.4,
}: {
  value: number;
  suffix?: string;
  duration?: number;
}) {
  const { ref, shown, reduce } = useRevealGate();
  const mv = useMotionValue(0);
  const spring = useSpring(mv, { damping: 40, stiffness: 90 });

  useEffect(() => {
    if (shown) {
      if (reduce) {
        mv.set(value);
      } else {
        const start = performance.now();
        let raf = 0;
        const tick = (now: number) => {
          const p = Math.min(1, (now - start) / (duration * 1000));
          const eased = 1 - Math.pow(1 - p, 3);
          mv.set(value * eased);
          if (p < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
      }
    }
  }, [shown, value, reduce, duration, mv]);

  useEffect(() => {
    return spring.on('change', (latest) => {
      if (ref.current) {
        ref.current.textContent = Math.round(latest).toLocaleString('en-US') + suffix;
      }
    });
  }, [spring, suffix, ref]);

  return <span ref={ref as React.Ref<HTMLSpanElement>}>0{suffix}</span>;
}

/* ------------------------------------------------------------------ */
/* TiltCard — controlled 3D tilt following the cursor                  */
/* ------------------------------------------------------------------ */
type TiltCardProps = {
  children: ReactNode;
  className?: string;
  max?: number;
  scale?: number;
  spotlight?: boolean;
};

export function TiltCard({ children, className, max = 7, scale = 1.01, spotlight = false }: TiltCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion() ?? false;
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const mx = useMotionValue(50);
  const my = useMotionValue(50);

  const sx = useSpring(rx, { stiffness: 180, damping: 22 });
  const sy = useSpring(ry, { stiffness: 180, damping: 22 });
  const varX = useMotionTemplate`${mx}%`;
  const varY = useMotionTemplate`${my}%`;

  function handleMove(e: MouseEvent<HTMLDivElement>) {
    if (reduce) return;
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    ry.set((px - 0.5) * max * 2);
    rx.set(-(py - 0.5) * max * 2);
    mx.set(px * 100);
    my.set(py * 100);
  }

  function handleLeave() {
    rx.set(0);
    ry.set(0);
  }

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      style={
        spotlight
          ? ({ rotateX: sx, rotateY: sy, transformStyle: 'preserve-3d', '--mx': varX, '--my': varY } as React.CSSProperties)
          : { rotateX: sx, rotateY: sy, transformStyle: 'preserve-3d' }
      }
      whileHover={reduce ? undefined : { scale }}
      className={cn('will-change-transform', spotlight && 'spotlight', className)}
    >
      {children}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Bar — animated fill bar for mini UIs                                */
/* ------------------------------------------------------------------ */
export function Bar({
  value,
  className,
  delay = 0,
}: {
  value: number;
  className?: string;
  delay?: number;
}) {
  const { ref, shown, reduce } = useRevealGate();
  const target = { height: `${value}%` };
  return (
    <motion.div
      ref={ref as React.Ref<HTMLDivElement>}
      initial={reduce ? target : { height: 0 }}
      animate={shown ? target : { height: 0 }}
      transition={{ duration: reduce ? 0 : 0.9, delay: reduce ? 0 : delay, ease: [0.16, 1, 0.3, 1] }}
      className={cn('w-full rounded-[3px]', className)}
    />
  );
}

/* ------------------------------------------------------------------ */
/* useLandingStats — fetch real public stats from the backend          */
/* ------------------------------------------------------------------ */
export function useLandingStats() {
  const [stats, setStats] = useState({ students: 0, exams: 0, instructors: 0, questions: 0 });

  useEffect(() => {
    api
      .get('/dashboard/public-stats')
      .then((res) => {
        if (res.data?.data) {
          const d = res.data.data;
          setStats({
            students: d.students ?? 0,
            exams: d.exams ?? 0,
            instructors: d.instructors ?? 0,
            questions: d.questions ?? 0,
          });
        }
      })
      .catch(() => {
        /* stats remain at 0 */
      });
  }, []);

  return stats;
}