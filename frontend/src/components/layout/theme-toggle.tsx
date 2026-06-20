'use client';

import { Laptop, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

export function ThemeToggle() {
  const { setTheme, theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const modes = [
    { value: 'light', icon: Sun, label: 'Light theme' },
    { value: 'dark', icon: Moon, label: 'Dark theme' },
    { value: 'system', icon: Laptop, label: 'System theme' },
  ];

  return (
    <div className="flex rounded-full border border-neutral-800/80 bg-neutral-950/80 p-1 shadow-black/10 shadow-inner">
      {modes.map((mode) => {
        const Icon = mode.icon;
        const isActive = mounted && theme === mode.value;
        return (
          <Button
            key={mode.value}
            type="button"
            size="icon"
            aria-label={mode.label}
            title={mode.label}
            onClick={() => setTheme(mode.value)}
            className={`h-9 w-9 rounded-full transition-all duration-200 ${isActive ? 'bg-primary/15 text-primary shadow-md shadow-primary/10' : 'text-neutral-400 hover:text-neutral-100 hover:bg-white/5'}`}
            variant="ghost"
          >
            <Icon className="h-4 w-4" />
          </Button>
        );
      })}
    </div>
  );
}
