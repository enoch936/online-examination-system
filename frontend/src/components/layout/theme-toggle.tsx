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
    <div className="flex rounded-md border bg-background p-1">
      {modes.map((mode) => {
        const Icon = mode.icon;
        return (
          <Button
            key={mode.value}
            type="button"
            size="icon"
            variant={mounted && theme === mode.value ? 'secondary' : 'ghost'}
            aria-label={mode.label}
            title={mode.label}
            onClick={() => setTheme(mode.value)}
            className="h-8 w-8"
          >
            <Icon className="h-4 w-4" />
          </Button>
        );
      })}
    </div>
  );
}
