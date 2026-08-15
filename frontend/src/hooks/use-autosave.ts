'use client';

import { useEffect, useRef } from 'react';

export function useAutosave<T>(value: T, save: (value: T) => Promise<unknown>, delay = 5000) {
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const timer = window.setTimeout(() => {
      void save(value);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [delay, save, value]);
}
