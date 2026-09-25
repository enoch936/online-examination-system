'use client';

import { useEffect, useState } from 'react';
import { Users, FileCheck2, UserCog, ListChecks } from 'lucide-react';
import { api } from '@/services/api';
import { Counter } from './landing-primitives';
import type { ApiEnvelope } from '@/types/api';

type PublicStats = {
  students: number;
  exams: number;
  instructors: number;
  questions: number;
};

const METRICS = [
  { key: 'students' as const, label: 'Students', icon: Users },
  { key: 'exams' as const, label: 'Exams', icon: FileCheck2 },
  { key: 'instructors' as const, label: 'Instructors', icon: UserCog },
  { key: 'questions' as const, label: 'Questions', icon: ListChecks },
];

function usePublicStats() {
  const [stats, setStats] = useState<PublicStats | null>(null);

  useEffect(() => {
    let cancelled = false;
    let retry: number | undefined;

    const load = async () => {
      try {
        const res = await api.get<ApiEnvelope<PublicStats>>('/dashboard/public-stats', { timeout: 12000 });
        if (!cancelled) setStats(res.data.data);
      } catch {
        if (!cancelled) retry = window.setTimeout(load, 5000);
      }
    };

    void load();

    return () => {
      cancelled = true;
      if (retry !== undefined) window.clearTimeout(retry);
    };
  }, []);

  return stats;
}

export function PlatformStats() {
  const stats = usePublicStats();

  return (
    <section aria-label="Live platform statistics" className="relative isolate pb-10 md:pb-12">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border/80 to-transparent" />
      </div>

      <div className="w-full">
        <div className="glass-edge grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border/60 bg-card/40 backdrop-blur-xl sm:grid-cols-4">
          {METRICS.map(({ key, label, icon: Icon }) => {
            const value = stats?.[key];
            return (
              <div key={key} className="flex flex-col items-center gap-1.5 px-4 py-6 text-center sm:py-8">
                <Icon className="h-4 w-4 text-primary/70" />
                <span className="text-2xl font-semibold tracking-tight tabular-nums text-foreground sm:text-3xl">
                  {value === undefined ? '—' : <Counter value={value} duration={1.1} />}
                </span>
                <span className="text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}