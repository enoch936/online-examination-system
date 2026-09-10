'use client';

import { BellRing, CheckCheck, Globe, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { usePushNotifications } from '@/hooks/use-push-notifications';

export function PushPreferences() {
  const { supported, enabled, loading, permission, enable, disable } = usePushNotifications();

  if (!supported) return null;

  const blocked = permission === 'denied';

  return (
    <Card>
      <CardHeader className="flex-row items-start gap-3 space-y-0">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <BellRing className="h-4 w-4" />
        </div>
        <div className="flex-1 space-y-1">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-sm">Browser notifications</CardTitle>
            {enabled ? (
              <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                <CheckCheck className="h-3.5 w-3.5" />
                On
              </span>
            ) : (
              <span className="text-xs font-medium text-muted-foreground">Off</span>
            )}
          </div>
          <CardDescription className="text-sm">
            Get push notifications for exam assignments and request decisions, even when this tab is closed.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-3">
          {enabled ? (
            <Button variant="outline" size="sm" onClick={disable} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellRing className="h-4 w-4" />}
              Disable
            </Button>
          ) : (
            <Button size="sm" onClick={enable} disabled={loading || blocked}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellRing className="h-4 w-4" />}
              Enable
            </Button>
          )}
          {blocked && (
            <span className="flex items-center gap-1.5 text-xs text-destructive">
              <Globe className="h-3.5 w-3.5" />
              Notifications are blocked — allow them for this site in your browser settings.
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}