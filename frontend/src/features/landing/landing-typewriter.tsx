'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/* TypeCycler — types, pauses, deletes, then the next word.            */
/* Wraps each word with a subtle blur/shrink emergence.                */
/* ------------------------------------------------------------------ */
export function TypeCycler({
  words,
  typeSpeed = 70,
  deleteSpeed = 36,
  holdDelay = 1400,
  className,
}: {
  words: string[];
  typeSpeed?: number;
  deleteSpeed?: number;
  holdDelay?: number;
  className?: string;
}) {
  const reduce = useReducedMotion() ?? false;
  const [index, setIndex] = useState(0);
  const [text, setText] = useState('');
  const [phase, setPhase] = useState<'typing' | 'holding' | 'deleting'>('typing');

  useEffect(() => {
    if (reduce) return;
    const word = words[index % words.length];

    if (phase === 'typing') {
      const t = setTimeout(() => {
        setText(word.slice(0, text.length + 1));
        if (text.length + 1 >= word.length) setPhase('holding');
      }, typeSpeed);
      return () => clearTimeout(t);
    }
    if (phase === 'holding') {
      const t = setTimeout(() => setPhase('deleting'), holdDelay);
      return () => clearTimeout(t);
    }
    // deleting
    const t = setTimeout(() => {
      if (text.length === 0) {
        setIndex((i) => i + 1);
        setPhase('typing');
      } else {
        setText(text.slice(0, -1));
      }
    }, deleteSpeed);
    return () => clearTimeout(t);
  }, [reduce, text, phase, index, words, typeSpeed, deleteSpeed, holdDelay]);

  // Reduced motion: render the first word statically, no animation.
  const shown = reduce ? words[0] : text;

  // Fixed-height container so layout doesn't jump
  return (
    <span
      className={cn('relative inline-flex min-h-[1.35em] items-baseline align-baseline', className)}
    >
      <AnimatePresence mode="wait">
        <motion.span
          key={shown}
          initial={reduce ? false : { opacity: 0, filter: 'blur(6px)', scale: 0.92 }}
          animate={{ opacity: 1, filter: 'blur(0px)', scale: 1 }}
          exit={reduce ? undefined : { opacity: 0, filter: 'blur(6px)', scale: 0.95 }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          className="inline-block font-medium text-foreground"
        >
          {shown}
          {!reduce && phase !== 'deleting' && (
            <span className="ml-0.5 inline-block w-[0.14em] animate-pulse bg-current align-[-0.1em]" />
          )}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}