'use client';

import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    turnstile?: {
      render: (container: HTMLElement, options: Record<string, unknown>) => string;
      remove: (widgetId: string) => void;
      reset: (widgetId: string) => void;
    };
  }
}

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';

type TurnstileWidgetProps = {
  onVerify: (token: string | null) => void;
  className?: string;
};

/**
 * Cloudflare Turnstile widget. Renders nothing when NEXT_PUBLIC_TURNSTILE_SITE_KEY
 * is unset (backend fails open when TURNSTILE_SECRET_KEY is unset, so dev stays
 * usable). The challenges.cloudflare.com origin is allowlisted in the CSP.
 */
export function TurnstileWidget({ onVerify, className }: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!SITE_KEY || !containerRef.current) return undefined;

    let cancelled = false;

    function mount() {
      if (cancelled || !containerRef.current || !window.turnstile) return;
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: SITE_KEY,
        theme: 'auto',
        callback: (token: string) => onVerify(token),
        'expired-callback': () => onVerify(null),
        'error-callback': () => onVerify(null),
      });
    }

    if (window.turnstile) {
      mount();
      return undefined;
    }

    const existing = document.querySelector<HTMLScriptElement>('script[src*="challenges.cloudflare.com/turnstile"]');
    const script = existing ?? document.createElement('script');
    if (!existing) {
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
    script.addEventListener('load', mount);

    return () => {
      cancelled = true;
      script.removeEventListener('load', mount);
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!SITE_KEY) return null;

  return <div ref={containerRef} className={className} data-testid="turnstile-widget" />;
}