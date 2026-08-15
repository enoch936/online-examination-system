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
    <div className="flex rounded-full border border-border bg-muted/60 p-1 shadow-sm">
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
            className={`h-8 w-8 rounded-full transition-all duration-200 ${isActive ? 'bg-primary text-primary-foreground shadow-md shadow-primary/25' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
            variant="ghost"
          >
            <Icon className="h-4 w-4" />
          </Button>
        );
      })}
    </div>
  );
}
