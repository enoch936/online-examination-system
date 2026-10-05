'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { classesService } from '@/services/classes.service';
import { examsService } from '@/services/exams.service';
import { messagesService } from '@/services/messages.service';
import { monitoringService } from '@/services/monitoring.service';
import { requestsService } from '@/services/requests.service';
import { getSocket } from '@/services/socket.service';
import { getIceServers } from '@/services/webrtc';
import { useAuthStore } from '@/store/auth.store';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { formatDuration } from '@/lib/utils';
import { apiErrorMessage } from '@/lib/api-error';
import type { ExamSummary, StudentMessage } from '@/types/api';
import type { InstructorAction, LiveStats, MonitorConfig, MonitoringEvent, SessionSnapshot } from '@/types/monitoring';
import {
  Activity, AlertTriangle, ArrowLeft, CheckCircle, Clock, Eye, Flag, Gauge, History, ListVideo,
  Loader2, MessageSquare, Mic, Monitor, Pause, Play, RefreshCw, Send, ShieldAlert, Timer, Users, Video, Wifi, WifiOff, XCircle,
} from 'lucide-react';

const RISK_VARIANT: Record<string, 'success' | 'warning' | 'secondary'> = {
  LOW: 'success',
  MEDIUM: 'secondary',
  HIGH: 'warning',
  CRITICAL: 'warning',
};

// Mirrors PERMISSION_LEVEL_RANK / ACTION_LEVEL in backend/src/common/exam-access.service.ts.
// Renders each action only where the backend would accept it, so a shared
// instructor no longer clicks Extend and gets a 403.
const PERMISSION_RANK: Record<string, number> = {
  VIEWER: 1,
  MONITOR: 2,
  PROCTOR: 3,
  CO_OWNER: 4,
};

const RANK_PROCTOR = 3;
const RANK_CO_OWNER = 4;

type ExamAccess = Pick<ExamSummary, 'isOwner' | 'myPermission'>;

function rankForAccess(access: ExamAccess): number {
  // Admins and the exam creator are flagged isOwner by the exam list, and the
  // backend lets both bypass the share level for every action.
  if (access.isOwner || access.myPermission === 'OWNER') return RANK_CO_OWNER + 1;
  return access.myPermission ? PERMISSION_RANK[access.myPermission] ?? 0 : 0;
}

function canPerform(access: ExamAccess, requiredRank: number): boolean {
  return rankForAccess(access) >= requiredRank;
}

// The same page serves /instructor/exams/monitor and /admin/exams/monitor, so
// the badge follows the signed-in role instead of assuming the instructor.
function useViewerRoleLabel(): string {
  const primaryRole = useAuthStore((state) => state.user?.roles[0]);
  if (primaryRole === 'SUPER_ADMIN') return 'Super Admin';
  if (primaryRole === 'ADMIN') return 'Admin';
  return 'Instructor';
}

function ConnectionBadge({ state }: { state: string }) {
  if (state === 'CONNECTED') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
        <Wifi className="h-3.5 w-3.5" /> Online
      </span>
    );
  }
  if (state === 'RECONNECTING') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-amber-600">
        <Activity className="h-3.5 w-3.5" /> Reconnecting
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <WifiOff className="h-3.5 w-3.5" /> Offline
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variant =
    status === 'IN_PROGRESS'
      ? 'success'
      : status === 'PAUSED' || status === 'EXPIRED'
        ? 'warning'
        : 'secondary';
  return <Badge variant={variant}>{status === 'AUTO_SUBMITTED' ? 'AUTO-SUBMITTED' : status.replace('_', ' ')}</Badge>;
}

function StatsCards({ stats }: { stats?: LiveStats | null }) {
  const items: Array<{ label: string; value: string | number; icon: ReactNode; tone?: string }> = [
    { label: 'Active sessions', value: stats?.active ?? 0, icon: <Users className="h-4 w-4" /> },
    { label: 'Online now', value: stats?.online ?? 0, icon: <Wifi className="h-4 w-4" /> },
    { label: 'Submitted', value: stats?.submitted ?? 0, icon: <CheckCircle className="h-4 w-4" /> },
    { label: 'Avg completion', value: `${stats?.avgCompletion ?? 0}%`, icon: <Gauge className="h-4 w-4" /> },
    { label: 'At risk', value: stats?.atRisk ?? 0, icon: <AlertTriangle className="h-4 w-4" />, tone: 'text-amber-600' },
    { label: 'Critical', value: stats?.critical ?? 0, icon: <ShieldAlert className="h-4 w-4" />, tone: 'text-red-600' },
    { label: 'Disconnected', value: stats?.disconnected ?? 0, icon: <WifiOff className="h-4 w-4" /> },
    { label: 'Suspicious events', value: stats?.suspiciousEvents ?? 0, icon: <Activity className="h-4 w-4" /> },
  ];
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <Card key={item.label} className="card-hover">
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-2xl font-bold tabular-nums">{item.value}</p>
              <p className="text-xs text-muted-foreground">{item.label}</p>
            </div>
            <div className={`text-muted-foreground ${item.tone ?? ''}`}>{item.icon}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function SessionActions({
  session,
  access,
  onOpenEvents,
  onOpenHistory,
}: {
  session: SessionSnapshot;
  access: ExamAccess;
  onOpenEvents: () => void;
  onOpenHistory: () => void;
}) {
  const queryClient = useQueryClient();
  const actionMutation = useMutation({
    mutationFn: (args: { sessionId: string; payload: { action: InstructorAction; message?: string; minutes?: number } }) =>
      monitoringService.action(args.sessionId, args.payload),
    onSuccess: () => {
      toast.success('Action sent');
      void queryClient.invalidateQueries({ queryKey: ['monitor-sessions', session.examId] });
    },
    onError: () => toast.error('Failed to send action'),
  });

  // Extensions go through the dedicated time-extension endpoint rather than the
  // generic `extend` action so the grant is validated, persisted as an audit row
  // and notified. The generic action silently did none of that.
  const extendMutation = useMutation({
    mutationFn: (minutes: number) =>
      monitoringService.extendTime(session.examId, {
        minutes,
        studentIds: [session.studentId],
      }),
    onSuccess: (outcome) => {
      const extended = outcome.extended;
      if (extended === 0) {
        const why = outcome.skipped[0]?.reason ?? 'No eligible session';
        toast.error(`Not extended — ${why}`);
      } else {
        toast.success(`Added time to ${extended} session${extended === 1 ? '' : 's'}`);
      }
      void queryClient.invalidateQueries({ queryKey: ['monitor-sessions', session.examId] });
      void queryClient.invalidateQueries({ queryKey: ['time-extensions', session.examId] });
    },
    onError: (err: unknown) => toast.error(apiErrorMessage(err, 'Failed to extend time')),
  });

  const active = session.status === 'IN_PROGRESS' || session.status === 'PAUSED';
  if (!active) return null;

  const canProctor = canPerform(access, RANK_PROCTOR);
  const canCoOwner = canPerform(access, RANK_CO_OWNER);

  const run = (action: { action: InstructorAction; message?: string; minutes?: number }) => {
    actionMutation.mutate({ sessionId: session.sessionId, payload: action });
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Button size="sm" variant="outline" onClick={onOpenEvents}>
        <Eye className="mr-1 h-3.5 w-3.5" /> Events
      </Button>
      {canProctor && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            const message = window.prompt('Warning message');
            if (message) run({ action: 'warning', message });
          }}
        >
          <MessageSquare className="mr-1 h-3.5 w-3.5" /> Warn
        </Button>
      )}
      {canCoOwner && session.status === 'PAUSED' && session.resumePending && (
        <>
          <Button size="sm" variant="outline" onClick={() => run({ action: 'approve_resume' })}>
            <CheckCircle className="mr-1 h-3.5 w-3.5" /> Approve
          </Button>
          <Button size="sm" variant="destructive" onClick={() => run({ action: 'deny_resume', message: 'Resume request denied' })}>
            <XCircle className="mr-1 h-3.5 w-3.5" /> Deny
          </Button>
        </>
      )}
      {canProctor &&
        (session.status === 'PAUSED' && !session.resumePending ? (
          <Button size="sm" variant="outline" onClick={() => run({ action: 'resume' })}>
            <Play className="mr-1 h-3.5 w-3.5" /> Resume
          </Button>
        ) : session.status === 'IN_PROGRESS' ? (
          <Button size="sm" variant="outline" onClick={() => run({ action: 'pause' })}>
            <Pause className="mr-1 h-3.5 w-3.5" /> Pause
          </Button>
        ) : null)}
      {canProctor && (
        <Button
          size="sm"
          variant="outline"
          disabled={extendMutation.isPending}
          title={
            session.totalExtensionMinutes
              ? `${session.totalExtensionMinutes} minutes already granted`
              : 'Grant additional time to this candidate'
          }
          onClick={() => {
            const input = window.prompt('Minutes to extend (1-120)', '10');
            if (input === null) return;
            // The API takes whole minutes only; round here so a decimal entry is
            // accepted instead of coming back as a 400.
            const minutes = Math.round(Number(input));
            if (!Number.isFinite(minutes) || minutes < 1 || minutes > 120) {
              toast.error('Enter a whole number of minutes between 1 and 120');
              return;
            }
            extendMutation.mutate(minutes);
          }}
        >
          {extendMutation.isPending ? (
            <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Clock className="mr-1 h-3.5 w-3.5" />
          )}
          Extend
        </Button>
      )}
      {canProctor && (
        <Button size="sm" variant="ghost" onClick={onOpenHistory} title="Extension history">
          <History className="mr-1 h-3.5 w-3.5" /> History
        </Button>
      )}
      {canCoOwner && (
        <Button
          size="sm"
          variant="destructive"
          onClick={() => {
            if (window.confirm('Force submit this session now?')) run({ action: 'force_submit' });
          }}
        >
          <Send className="mr-1 h-3.5 w-3.5" /> Submit
        </Button>
      )}
      {canCoOwner && (
        <Button
          size="sm"
          variant="destructive"
          onClick={() => {
            if (window.confirm('Disconnect this candidate?')) run({ action: 'disconnect' });
          }}
        >
          <WifiOff className="mr-1 h-3.5 w-3.5" /> Disconnect
        </Button>
      )}
    </div>
  );
}

function SessionTable({
  sessions,
  access,
  onOpenEvents,
  onOpenHistory,
}: {
  sessions: SessionSnapshot[];
  access: ExamAccess;
  onOpenEvents: (s: SessionSnapshot) => void;
  onOpenHistory: (s: SessionSnapshot) => void;
}) {
  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center">
        <Users className="h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">No sessions yet for this exam</p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {sessions.map((s) => (
        <Card key={s.sessionId}>
          <CardContent className="p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium truncate">
                    {s.student ? `${s.student.firstName} ${s.student.lastName}` : s.studentId}
                  </p>
                  <StatusBadge status={s.status} />
                  <Badge variant={RISK_VARIANT[s.riskLevel] ?? 'secondary'}>
                    Risk {s.riskScore} · {s.riskLevel}
                  </Badge>
                  <ConnectionBadge state={s.connectionState} />
                  {s.resumePending && (
                    <Badge variant="warning" className="gap-1">
                      <Clock className="h-3 w-3" />
                      Awaiting approval
                    </Badge>
                  )}
                  {s.reportCount > 0 && (
                    <Badge variant="warning" className="gap-1">
                      <Flag className="h-3 w-3" />
                      {s.reportCount} student report{s.reportCount === 1 ? '' : 's'}
                    </Badge>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>
                    {s.answeredCount}/{s.totalQuestions} answered
                  </span>
                  <span>
                    <Timer className="mr-1 inline h-3 w-3" />
                    {s.remainingSeconds != null ? formatDuration(s.remainingSeconds) : '—'}
                  </span>
                  <span>
                    <Activity className="mr-1 inline h-3 w-3" />
                    {s.violationsCount} violation{s.violationsCount === 1 ? '' : 's'}
                  </span>
                  <span>
                    <Gauge className="mr-1 inline h-3 w-3" />
                    {Math.round(s.progress)}%
                  </span>
                  {(s.totalExtensionMinutes ?? 0) > 0 && (
                    <span className="text-amber-600" title="Extra time granted by a proctor">
                      <Clock className="mr-1 inline h-3 w-3" />+{s.totalExtensionMinutes} min granted
                    </span>
                  )}
                </div>
                <div className="mt-2 h-1.5 w-full max-w-md overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${Math.min(100, Math.max(0, s.progress))}%` }}
                  />
                </div>
              </div>
              <SessionActions
                session={s}
                access={access}
                onOpenEvents={() => onOpenEvents(s)}
                onOpenHistory={() => onOpenHistory(s)}
              />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function EventsFeed({ session, config }: { session: SessionSnapshot; config?: MonitorConfig }) {
  const { data: events, isLoading } = useQuery({
    queryKey: ['monitor-events', session.sessionId],
    queryFn: () => monitoringService.events(session.sessionId),
    refetchInterval: 15000,
  });

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Live activity</p>
        {config?.eventLoggingEnabled === false && (
          <Badge variant="outline">Event logging disabled by exam</Badge>
        )}
      </div>
      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      ) : (events ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">No events recorded yet.</p>
      ) : (
        <div className="max-h-80 space-y-1.5 overflow-y-auto pr-1">
          {(events ?? []).map((event: MonitoringEvent) => {
            const metadata =
              event.metadata && typeof event.metadata === 'object'
                ? (event.metadata as Record<string, unknown>)
                : undefined;
            const message = typeof metadata?.message === 'string' ? metadata.message : undefined;
            return (
              <div key={event.id} className="flex items-start justify-between gap-2 rounded-md border px-3 py-2 text-sm">
                <div className="min-w-0">
                  <p className="font-medium">{event.type.replace(/_/g, ' ')}</p>
                  {message && <p className="text-xs text-muted-foreground">{message}</p>}
                  <p className="text-xs text-muted-foreground">{new Date(event.timestamp).toLocaleString()}</p>
                </div>
                {event.type === 'MANUAL_FLAG' ? (
                  <Badge variant="warning" className="gap-1">
                    <Flag className="h-3 w-3" /> Student report
                  </Badge>
                ) : event.kind === 'violation' ? (
                  <Badge variant={Number(event.severity) >= 2 ? 'warning' : 'secondary'}>Violation</Badge>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

type MonitorToggleKey = 'webcamEnabled' | 'micEnabled' | 'aiDetectionEnabled' | 'screenMonitoring' | 'recordingEnabled' | 'eventLoggingEnabled' | 'requireConsent' | 'trackTabSwitches' | 'trackWindowBlur' | 'disableCopy' | 'disablePaste' | 'detectClipboard' | 'detectShortcuts';

type MonitorModeKey = 'webcamMode' | 'micMode';
type MonitorPolicyKey = 'fullscreenPolicy' | 'strictness';

const MONITORING_TOGGLES: Array<{ key: MonitorToggleKey; label: string; icon: ReactNode; hint: string }> = [
  { key: 'webcamEnabled', label: 'Webcam monitoring', icon: <Video className="h-4 w-4" />, hint: 'Stream the candidate camera to this monitor.' },
  { key: 'micEnabled', label: 'Microphone monitoring', icon: <Mic className="h-4 w-4" />, hint: 'Analyze audio activity during the exam.' },
  { key: 'aiDetectionEnabled', label: 'AI detection', icon: <ShieldAlert className="h-4 w-4" />, hint: 'Face, motion and audio signals from the analyzer.' },
  { key: 'screenMonitoring', label: 'Screen monitoring', icon: <Monitor className="h-4 w-4" />, hint: 'Track window and tab focus.' },
  { key: 'recordingEnabled', label: 'Recording', icon: <ListVideo className="h-4 w-4" />, hint: 'Enable session recording.' },
  { key: 'eventLoggingEnabled', label: 'Event logging', icon: <Activity className="h-4 w-4" />, hint: 'Record candidate activity events.' },
  { key: 'requireConsent', label: 'Require consent', icon: <ShieldAlert className="h-4 w-4" />, hint: 'Prompt candidates before proctoring starts.' },
  { key: 'trackTabSwitches', label: 'Track tab switches', icon: <Monitor className="h-4 w-4" />, hint: 'Flag when candidates switch away from the exam tab.' },
  { key: 'trackWindowBlur', label: 'Track window blur', icon: <Activity className="h-4 w-4" />, hint: 'Flag when the exam window loses focus.' },
  { key: 'disableCopy', label: 'Disable copy', icon: <ListVideo className="h-4 w-4" />, hint: 'Block copying during the exam.' },
  { key: 'disablePaste', label: 'Disable paste', icon: <ListVideo className="h-4 w-4" />, hint: 'Block pasting during the exam.' },
  { key: 'detectClipboard', label: 'Detect clipboard', icon: <Activity className="h-4 w-4" />, hint: 'Log clipboard reads by the candidate.' },
  { key: 'detectShortcuts', label: 'Detect shortcuts', icon: <ShieldAlert className="h-4 w-4" />, hint: 'Log shortcut key presses that bypass restrictions.' },
];

const MODE_OPTIONS: Record<MonitorModeKey, string[]> = {
  webcamMode: ['DISABLED', 'OPTIONAL', 'REQUIRED'],
  micMode: ['DISABLED', 'OPTIONAL', 'REQUIRED'],
};

const POLICY_OPTIONS: Record<MonitorPolicyKey, string[]> = {
  fullscreenPolicy: ['DISABLED', 'OPTIONAL', 'REQUIRED'],
  strictness: ['RELAXED', 'STANDARD', 'STRICT'],
};

const INPUT_CLASS = 'h-9 rounded-lg border bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring';

function MonitoringSettings({ examId, config }: { examId: string; config?: MonitorConfig }) {
  const queryClient = useQueryClient();
  const saveConfig = useMutation({
    mutationFn: (payload: Partial<MonitorConfig>) => monitoringService.saveConfig(examId, payload),
    onSuccess: () => {
      toast.success('Monitoring settings saved');
      void queryClient.invalidateQueries({ queryKey: ['monitor-config', examId] });
    },
    onError: () => toast.error('Failed to save monitoring settings'),
  });

  const toggle = (key: MonitorToggleKey) => {
    if (!config) return;
    saveConfig.mutate({ [key]: !config[key] } as Partial<MonitorConfig>);
  };

  const setValue = (key: string, value: string | number) => {
    if (!config) return;
    saveConfig.mutate({ [key]: value } as Partial<MonitorConfig>);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Monitoring settings</CardTitle>
          {config && (
            <Badge variant={config.webcamEnabled ? 'success' : 'secondary'}>
              {config.webcamEnabled ? 'Webcam on' : 'Webcam off'}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-1">
        <div className="grid gap-3 px-2 py-2 sm:grid-cols-2 lg:grid-cols-4">
          {(['webcamMode', 'micMode'] as MonitorModeKey[]).map((key) => (
            <label key={key} className="flex flex-col gap-1.5 text-xs text-muted-foreground">
              {key === 'webcamMode' ? 'Webcam mode' : 'Microphone mode'}
              <select
                className={INPUT_CLASS}
                value={config?.[key] ?? 'DISABLED'}
                disabled={!config || saveConfig.isPending}
                onChange={(e) => setValue(key, e.target.value)}
              >
                {MODE_OPTIONS[key].map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </label>
          ))}
          {(['fullscreenPolicy', 'strictness'] as MonitorPolicyKey[]).map((key) => (
            <label key={key} className="flex flex-col gap-1.5 text-xs text-muted-foreground">
              {key === 'fullscreenPolicy' ? 'Fullscreen policy' : 'Strictness'}
              <select
                className={INPUT_CLASS}
                value={config?.[key] ?? (key === 'fullscreenPolicy' ? 'OPTIONAL' : 'STANDARD')}
                disabled={!config || saveConfig.isPending}
                onChange={(e) => setValue(key, e.target.value)}
              >
                {POLICY_OPTIONS[key].map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </label>
          ))}
          <label className="flex flex-col gap-1.5 text-xs text-muted-foreground">
            Violations before flag
            <input
              type="number"
              min={1}
              max={100}
              className={INPUT_CLASS}
              value={config?.violationThreshold ?? 3}
              disabled={!config || saveConfig.isPending}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (Number.isFinite(v) && v >= 1 && v <= 100) setValue('violationThreshold', v);
              }}
            />
          </label>
        </div>
        {MONITORING_TOGGLES.map(({ key, label, icon, hint }) => (
          <div
            key={key}
            className="flex items-center justify-between gap-4 rounded-md px-2 py-2.5 transition-colors hover:bg-muted/50"
          >
            <div className="flex items-start gap-3">
              <span className="mt-0.5 text-muted-foreground">{icon}</span>
              <div>
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs text-muted-foreground">{hint}</p>
              </div>
            </div>
            <Switch
              checked={config?.[key] ?? false}
              disabled={!config || saveConfig.isPending}
              onCheckedChange={() => toggle(key)}
            />
          </div>
        ))}
        <p className="px-2 pt-2 text-xs text-muted-foreground">
          Changes apply to candidates who have not yet started. Existing sessions pick up new webcam/audio requirements on their next check.
        </p>
      </CardContent>
    </Card>
  );
}

function LiveChatPanel({ examId, messages }: { examId: string; messages: StudentMessage[] }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(true);

  const newCount = messages.filter((m) => m.status === 'NEW').length;

  const ackMutation = useMutation({
    mutationFn: ({ id, source, next }: { id: string; source: 'CONTACT' | 'EXAM_REPORT'; next: string }) =>
      messagesService.updateStatus(id, source, next),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['messages', examId] });
      toast.success('Message marked');
    },
    onError: () => toast.error('Failed to update message'),
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <button className="flex items-center gap-2" onClick={() => setOpen((v) => !v)}>
            <CardTitle className="text-base">Student messages</CardTitle>
            {newCount > 0 && (
              <Badge variant="warning" className="gap-1">
                <MessageSquare className="h-3 w-3" />
                {newCount} new
              </Badge>
            )}
          </button>
          {open && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void queryClient.invalidateQueries({ queryKey: ['messages', examId] })}
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </CardHeader>
      {open && (
        <CardContent className="space-y-2">
          {messages.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No messages yet. Students can send a report to their proctor during the exam.
            </p>
          ) : (
            <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
              {messages.map((m) => (
                <div key={m.id} className="rounded-md border px-3 py-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium">{m.name}</p>
                    <span className="text-xs text-muted-foreground">{new Date(m.createdAt).toLocaleTimeString()}</span>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">{m.message}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <Badge className={m.status === 'NEW' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'}>
                      {m.status}
                    </Badge>
                    {m.status === 'NEW' && (
                      <Button size="sm" variant="outline" onClick={() => ackMutation.mutate({ id: m.id, source: m.source, next: 'READ' })} disabled={ackMutation.isPending}>
                        <CheckCircle className="mr-1 h-3 w-3" /> Acknowledge
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

function AuditLogPanel({ examId }: { examId: string }) {
  const [open, setOpen] = useState(false);
  const { data: logs } = useQuery({
    queryKey: ['exam-audit', examId],
    queryFn: () => examsService.getAuditLogs(examId),
    enabled: open,
    refetchInterval: 30000,
  });

  const label = (action: string) => action.replace(/_/g, ' ').toLowerCase();

  return (
    <Card>
      <CardHeader className="pb-3">
        <button className="flex items-center gap-2" onClick={() => setOpen((v) => !v)}>
          <CardTitle className="text-base">Audit activity</CardTitle>
          <Badge variant="secondary">{(logs ?? []).length}</Badge>
        </button>
      </CardHeader>
      {open && (
        <CardContent className="space-y-1">
          {(logs ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No audit activity recorded yet.</p>
          ) : (
            <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
              {(logs ?? []).map((log) => (
                <div key={log.id} className="rounded-md border px-3 py-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium">{log.actor ? `${log.actor.firstName} ${log.actor.lastName}` : 'Unknown'}</p>
                    <span className="text-xs text-muted-foreground">{new Date(log.createdAt).toLocaleString()}</span>
                  </div>
                  <p className="text-xs text-muted-foreground capitalize">{label(log.action)}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

function PendingRequestsPanel({ examId }: { examId: string }) {
  const queryClient = useQueryClient();
  const [reasonOpen, setReasonOpen] = useState<string | null>(null);

  const { data: requests } = useQuery({
    queryKey: ['exam-requests', examId],
    queryFn: () => requestsService.listPending(examId),
    refetchInterval: 15000,
  });

  const decideMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'approve' | 'reject' }) =>
      requestsService.decide(id, action),
    onSuccess: () => {
      toast.success('Request updated');
      void queryClient.invalidateQueries({ queryKey: ['exam-requests', examId] });
      void queryClient.invalidateQueries({ queryKey: ['monitor-sessions', examId] });
    },
    onError: () => toast.error('Failed to update request'),
  });

  const pending = useMemo(() => {
    const retake = (requests?.retake ?? []).map((r) => ({ kind: 'retake' as const, request: r }));
    const resume = (requests?.resume ?? []).map((r) => ({ kind: 'resume' as const, request: r }));
    return [...retake, ...resume].filter((r) => r.request.status === 'PENDING');
  }, [requests]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4" /> Pending requests
          </CardTitle>
          <Badge variant="warning">{pending.length}</Badge>
        </div>
      </CardHeader>
      {pending.length === 0 ? (
        <CardContent className="pt-0"><p className="text-sm text-muted-foreground">No pending retake or resume requests.</p></CardContent>
      ) : (
        <CardContent className="space-y-2 pt-0">
          {pending.map((entry) => {
            const r = entry.request;
            const student = r.student;
            const name = student ? `${student.firstName} ${student.lastName}` : (r.studentId ?? 'Student');
            return (
              <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
                <div className="min-w-0">
                  <p className="font-medium">
                    {entry.kind === 'retake' ? 'Retake' : 'Resume'} — {name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(r.requestedAt).toLocaleString()}
                    {r.reason ? ` · ${r.reason}` : ''}
                  </p>
                  {entry.kind === 'resume' && (
                    <button
                      className="mt-1 block text-xs text-primary underline"
                      onClick={() => setReasonOpen(reasonOpen === r.id ? null : r.id)}
                    >
                      {reasonOpen === r.id ? 'Hide optional message' : 'Add an optional message'}
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  {reasonOpen === r.id && (
                    <input
                      className="h-8 w-40 rounded-md border bg-background px-2 text-xs"
                      placeholder="Message"
                      defaultValue=""
                      id={`request-reason-${r.id}`}
                    />
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={decideMutation.isPending}
                    onClick={() => decideMutation.mutate({ id: r.id, action: 'approve' })}
                  >
                    <CheckCircle className="mr-1 h-3.5 w-3.5" /> Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={decideMutation.isPending}
                    onClick={() => decideMutation.mutate({ id: r.id, action: 'reject' })}
                  >
                    <XCircle className="mr-1 h-3.5 w-3.5" /> Reject
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      )}
    </Card>
  );
}

/**
 * Append-only grant history. Deliberately read-only: extensions are a
 * compliance record, so the UI offers no way to edit or delete one.
 */
function ExtensionHistoryPanel({
  examId,
  sessionId,
}: {
  examId: string;
  sessionId?: string;
}) {
  const [scope, setScope] = useState<'exam' | 'session'>(sessionId ? 'session' : 'exam');
  const activeSessionId = sessionId ?? '';

  const { data, isLoading } = useQuery({
    queryKey: ['time-extensions', examId, scope, activeSessionId],
    queryFn: () =>
      scope === 'session' && activeSessionId
        ? monitoringService.sessionExtensions(activeSessionId)
        : monitoringService.extensionHistory(examId),
    enabled: scope === 'exam' || Boolean(activeSessionId),
  });

  const records = data ?? [];

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4" /> Time extensions
          </CardTitle>
          {sessionId && (
            <div className="flex items-center gap-1">
              <Button size="sm" variant={scope === 'session' ? 'secondary' : 'ghost'} onClick={() => setScope('session')}>
                This session
              </Button>
              <Button size="sm" variant={scope === 'exam' ? 'secondary' : 'ghost'} onClick={() => setScope('exam')}>
                Whole exam
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : records.length === 0 ? (
          <p className="text-sm text-muted-foreground">No time has been granted for this exam.</p>
        ) : (
          <div className="space-y-2">
            {records.map((record) => (
              <div key={record.id} className="rounded-md border p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">
                    {record.student
                      ? `${record.student.firstName} ${record.student.lastName}`
                      : record.studentId}
                  </span>
                  <Badge variant="success">+{record.minutes} min</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Deadline {record.previousExpiresAt ? new Date(record.previousExpiresAt).toLocaleTimeString() : '—'} →{' '}
                  {new Date(record.newExpiresAt).toLocaleTimeString()} · total granted {record.totalExtensionMinutes} min
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {new Date(record.createdAt).toLocaleString()}
                  {record.grantedBy ? ` · by ${record.grantedBy.firstName} ${record.grantedBy.lastName}` : ''}
                  {record.reason ? ` · ${record.reason}` : ''}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * One/many/all grants in a single panel. Targeting is expressed as a mode
 * rather than as an optional student list, so "everyone" is impossible to
 * confuse with "the students I happened to have ticked".
 */
function BulkExtendPanel({ examId, access }: { examId: string; access: ExamAccess }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [minutes, setMinutes] = useState(10);
  const [mode, setMode] = useState<'all' | 'class'>('all');
  const [classId, setClassId] = useState('');
  const [reason, setReason] = useState('');
  const [result, setResult] = useState<string | null>(null);

  const allowed = canPerform(access, RANK_PROCTOR);
  const { data: classes } = useQuery({
    queryKey: ['classes'],
    queryFn: () => classesService.list(),
    enabled: open && mode === 'class',
  });

  const mutation = useMutation({
    mutationFn: () =>
      monitoringService.extendTime(examId, {
        minutes,
        reason: reason.trim() || undefined,
        ...(mode === 'class' ? { classId } : {}),
      }),
    onSuccess: (outcome) => {
      const skipped = outcome.skipped.length;
      setResult(
        `Granted ${outcome.extended} session${outcome.extended === 1 ? '' : 's'} · ` +
          `${outcome.notifications} notification${outcome.notifications === 1 ? '' : 's'} sent` +
          (skipped > 0 ? ` · ${skipped} skipped` : ''),
      );
      if (outcome.extended === 0) toast.error(`No session extended${skipped ? ` — ${outcome.skipped[0]?.reason}` : ''}`);
      else toast.success(`Added ${minutes} minutes to ${outcome.extended} session${outcome.extended === 1 ? '' : 's'}`);
      void queryClient.invalidateQueries({ queryKey: ['monitor-sessions', examId] });
      void queryClient.invalidateQueries({ queryKey: ['time-extensions', examId] });
    },
    onError: (err: unknown) => toast.error(apiErrorMessage(err, 'Failed to extend time')),
  });

  if (!allowed) return null;

  const submit = () => {
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 120) {
      toast.error('Enter a whole number of minutes between 1 and 120');
      return;
    }
    if (mode === 'class' && !classId) {
      toast.error('Choose a class');
      return;
    }
    setResult(null);
    mutation.mutate();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock className="h-4 w-4" /> Grant extra time
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!open ? (
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
            Extend time for many candidates
          </Button>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="text-xs text-muted-foreground">
                Minutes per candidate
                <input
                  type="number"
                  min={1}
                  max={120}
                  className="mt-1 h-9 w-full rounded-lg border bg-background px-3 text-sm"
                  value={minutes}
                  onChange={(e) => setMinutes(Number(e.target.value))}
                />
              </label>
              <label className="text-xs text-muted-foreground">
                Who
                <select
                  className="mt-1 h-9 w-full rounded-lg border bg-background px-3 text-sm"
                  value={mode}
                  onChange={(e) => setMode(e.target.value as 'all' | 'class')}
                >
                  <option value="all">Everyone currently in progress</option>
                  <option value="class">One class</option>
                </select>
              </label>
              {mode === 'class' && (
                <label className="text-xs text-muted-foreground">
                  Class
                  <select
                    className="mt-1 h-9 w-full rounded-lg border bg-background px-3 text-sm"
                    value={classId}
                    onChange={(e) => setClassId(e.target.value)}
                  >
                    <option value="">Choose a class</option>
                    {classes?.map((cls) => (
                      <option key={cls.id} value={cls.id}>
                        {cls.name} ({cls.code})
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="text-xs text-muted-foreground">
                Reason (stored in the audit trail)
                <input
                  className="mt-1 h-9 w-full rounded-lg border bg-background px-3 text-sm"
                  value={reason}
                  placeholder="e.g. power outage"
                  onChange={(e) => setReason(e.target.value)}
                />
              </label>
            </div>

            {result && <p className="text-sm text-emerald-600">{result}</p>}
            {mutation.data && mutation.data.skipped.length > 0 && (
              <div className="max-h-32 space-y-1 overflow-y-auto rounded-md border p-2 text-xs text-muted-foreground">
                {mutation.data.skipped.map((s) => (
                  <p key={s.sessionId}>
                    {s.sessionId}: {s.reason}
                  </p>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <Button size="sm" onClick={submit} disabled={mutation.isPending}>
                {mutation.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
                Grant time
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setOpen(false)} disabled={mutation.isPending}>
                Close
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function MonitorDetail({ examId, examTitle, access, onBack }: { examId: string; examTitle: string; access: ExamAccess; onBack: () => void }) {
  const queryClient = useQueryClient();
  const viewerRoleLabel = useViewerRoleLabel();
  const socketRef = useRef(getSocket());
  const [selectedSession, setSelectedSession] = useState<SessionSnapshot | null>(null);
  const [stats, setStats] = useState<LiveStats | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const peerSocketIdRef = useRef<string | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const { data: sessions, isLoading: sessionsLoading } = useQuery({
    queryKey: ['monitor-sessions', examId],
    queryFn: () => monitoringService.listSessions(examId),
    refetchInterval: 15000,
  });

  const { data: config } = useQuery({
    queryKey: ['monitor-config', examId],
    queryFn: () => monitoringService.config(examId),
  });

  const { data: chatMessages } = useQuery({
    queryKey: ['messages', examId],
    queryFn: () => messagesService.list(examId),
    refetchInterval: 15000,
  });

  const liveMessages = useMemo(
    () => (chatMessages ?? []).filter((m) => m.source === 'EXAM_REPORT').slice(0, 50),
    [chatMessages],
  );

  const endExamMutation = useMutation({
    mutationFn: (id: string) => examsService.endNow(id),
    onSuccess: () => {
      toast.success('Exam ended — open sessions were force-submitted');
      void queryClient.invalidateQueries({ queryKey: ['exams'] });
      void queryClient.invalidateQueries({ queryKey: ['monitor-sessions', examId] });
      onBack();
    },
    onError: () => toast.error('Failed to end exam'),
  });

  useEffect(() => {
    void examsService.openMonitor(examId).catch(() => undefined);
    void monitoringService.stats(examId).then(setStats).catch(() => undefined);
    const t = window.setInterval(() => {
      void monitoringService.stats(examId).then(setStats).catch(() => undefined);
    }, 10000);
    return () => window.clearInterval(t);
  }, [examId]);

  const applySnapshot = useCallback(
    (snapshot: SessionSnapshot) => {
      queryClient.setQueryData<SessionSnapshot[]>(['monitor-sessions', examId], (prev) => {
        if (!prev) return [snapshot];
        const idx = prev.findIndex((s) => s.sessionId === snapshot.sessionId);
        if (idx === -1) return [snapshot, ...prev];
        const next = [...prev];
        next[idx] = snapshot;
        return next;
      });
    },
    [examId, queryClient],
  );

  useEffect(() => {
    const socket = socketRef.current;

    // Rejoin the exam monitor room on every (re)connect; Socket.IO rooms are
    // per-connection and lost on reconnect, which would break live events and
    // proctoring offers.
    const joinMonitor = () => {
      if (!socket.connected) return;
      socket.emit('monitor:join', { examId });
    };
    socket.connect();
    socket.on('connect', joinMonitor);
    joinMonitor();

    const onCandidate = (snapshot: SessionSnapshot) => applySnapshot(snapshot);
    const onAlert = (alert: { student?: string; type: string; severity?: string; message?: string; studentId?: string }) => {
      const sev = alert.severity ?? 'MEDIUM';
      if (sev === 'CRITICAL' || sev === 'HIGH' || alert.type === 'MANUAL_FLAG') {
        toast.warning(`${alert.student ?? 'Candidate'} — ${alert.message ?? alert.type.replace(/_/g, ' ')}`);
      }
      void monitoringService.stats(examId).then(setStats).catch(() => undefined);
    };
    const onStats = (s: LiveStats) => setStats(s);
    const onConfig = () => {
      void queryClient.invalidateQueries({ queryKey: ['monitor-config', examId] });
    };
    const onEvent = (event: {
      id?: string;
      sessionId?: string;
      type?: string;
      metadata?: unknown;
      timestamp?: string;
      student?: { id?: string; firstName?: string; lastName?: string; email?: string };
    }) => {
      if (event.sessionId) {
        void queryClient.invalidateQueries({ queryKey: ['monitor-events', event.sessionId] });
      }
      if (event.type === 'MANUAL_FLAG') {
        const raw =
          typeof event.metadata === 'string'
            ? (() => { try { return JSON.parse(event.metadata); } catch { return null; } })()
            : event.metadata;
        const message =
          raw && typeof raw === 'object' && typeof (raw as Record<string, unknown>).message === 'string'
            ? ((raw as Record<string, unknown>).message as string).trim()
            : '';
        if (message) {
          const student = event.student;
          const name = student
            ? [student.firstName, student.lastName].filter(Boolean).join(' ') || student.email || 'Student'
            : 'Student';
          const entry: StudentMessage = {
            id: event.id ?? `live-${Date.now()}`,
            source: 'EXAM_REPORT',
            name,
            email: student?.email ?? '',
            message,
            status: 'NEW',
            createdAt: event.timestamp ?? new Date().toISOString(),
            examId,
            sessionId: event.sessionId,
          };
          queryClient.setQueryData<StudentMessage[]>(['messages', examId], (prev) => {
            if (!prev) return [entry];
            if (prev.some((m) => m.id === entry.id)) return prev;
            return [entry, ...prev].slice(0, 50);
          });
        }
      }
    };

    socket.on('monitor:candidate-update', onCandidate);
    socket.on('monitor:alert', onAlert);
    socket.on('monitor:stats', onStats);
    socket.on('monitor:config-updated', onConfig);
    socket.on('monitor:event', onEvent);

    return () => {
      socket.off('monitor:candidate-update', onCandidate);
      socket.off('monitor:alert', onAlert);
      socket.off('monitor:stats', onStats);
      socket.off('monitor:config-updated', onConfig);
      socket.off('monitor:event', onEvent);
      socket.off('connect', joinMonitor);
    };
  }, [applySnapshot, examId, queryClient]);

  const closeVideo = useCallback(() => {
    pcRef.current?.close();
    pcRef.current = null;
    peerSocketIdRef.current = null;
    setRemoteStream(null);
  }, []);

  const sessionId = selectedSession?.sessionId;
  useEffect(() => {
    if (!sessionId) {
      closeVideo();
      return;
    }
    const socket = socketRef.current;
    const onOffer = (payload: {
      sessionId: string;
      examId: string;
      offer: unknown;
      peerSocketId: string;
      student?: { name?: string };
    }) => {
      if (payload.sessionId !== sessionId) return;
      peerSocketIdRef.current = payload.peerSocketId;
      pcRef.current?.close();
      const pc = new RTCPeerConnection({ iceServers: getIceServers() });
      pcRef.current = pc;
      pc.onicecandidate = (e) => {
        if (e.candidate && peerSocketIdRef.current) {
          socket.emit('proctoring:ice', {
            sessionId: payload.sessionId,
            candidate: e.candidate,
            peerSocketId: peerSocketIdRef.current,
          });
        }
      };
      pc.ontrack = (e) => {
        if (e.streams[0]) setRemoteStream(e.streams[0]);
      };
      void pc
        .setRemoteDescription(payload.offer as RTCSessionDescriptionInit)
        .then(() => pc.createAnswer())
        .then((answer) => pc.setLocalDescription(answer))
        .then(() => {
          socket.emit('proctoring:answer', {
            sessionId: payload.sessionId,
            answer: pc.localDescription,
            peerSocketId: payload.peerSocketId,
          });
        })
        .catch(() => undefined);
    };
    const onIce = (payload: { sessionId: string; candidate: unknown }) => {
      if (payload.sessionId === sessionId && pcRef.current && payload.candidate) {
        void pcRef.current.addIceCandidate(payload.candidate as RTCIceCandidateInit);
      }
    };
    socket.on('proctoring:offer', onOffer);
    socket.on('proctoring:ice', onIce);
    return () => {
      socket.off('proctoring:offer', onOffer);
      socket.off('proctoring:ice', onIce);
    };
  }, [closeVideo, sessionId]);

  const sorted = useMemo(() => {
    const list = sessions ?? [];
    return [...list].sort((a, b) => b.riskScore - a.riskScore);
  }, [sessions]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{examTitle}</h1>
            <p className="text-sm text-muted-foreground">Live monitoring · updates in real time</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{viewerRoleLabel}</Badge>
          <Button
            variant="destructive"
            size="sm"
            disabled={endExamMutation.isPending}
            onClick={() => {
              if (window.confirm('End this exam now? All open sessions will be force-submitted and the exam will be closed, even if the scheduled time has not finished.')) {
                endExamMutation.mutate(examId);
              }
            }}
          >
            {endExamMutation.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <XCircle className="mr-1 h-3.5 w-3.5" />}
            End exam
          </Button>
        </div>
      </div>

      <StatsCards stats={stats} />

      <LiveChatPanel examId={examId} messages={liveMessages} />

      <PendingRequestsPanel examId={examId} />

      <MonitoringSettings examId={examId} config={config} />

      <AuditLogPanel examId={examId} />

      <BulkExtendPanel examId={examId} access={access} />

      <ExtensionHistoryPanel examId={examId} sessionId={selectedSession?.sessionId} />

      {sessionsLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : (
        <SessionTable
          sessions={sorted}
          access={access}
          onOpenEvents={setSelectedSession}
          onOpenHistory={setSelectedSession}
        />
      )}

      {selectedSession && (
        <Card className="border-primary/40">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                Session detail — {selectedSession.student ? `${selectedSession.student.firstName} ${selectedSession.student.lastName}` : selectedSession.studentId}
              </CardTitle>
              <div className="flex items-center gap-2">
                <SessionActions
                  session={selectedSession}
                  access={access}
                  onOpenEvents={() => undefined}
                  onOpenHistory={() => undefined}
                />
                <Button size="sm" variant="ghost" onClick={() => setSelectedSession(null)}>
                  Close
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-4">
              <div>
                <p className="mb-2 flex items-center gap-2 text-sm font-medium">
                  <Video className="h-4 w-4" /> Candidate camera
                </p>
                {remoteStream ? (
                  <video
                    ref={(el) => {
                      if (el && remoteStream) el.srcObject = remoteStream;
                    }}
                    autoPlay
                    playsInline
                    muted
                    className="aspect-video w-full rounded-lg border bg-black"
                  />
                ) : (
                  <div className="flex aspect-video w-full flex-col items-center justify-center rounded-lg border bg-muted/40 text-sm text-muted-foreground">
                    <ListVideo className="mb-2 h-8 w-8" />
                    Waiting for camera stream{config?.webcamEnabled ? '…' : ' (webcam disabled for this exam)'}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Mic className="h-3.5 w-3.5" />
                Audio monitoring: {config?.micEnabled ? 'on' : 'off'}
                <span className="mx-1">·</span>
                AI detection: {config?.aiDetectionEnabled ? 'on' : 'off'}
              </div>
            </div>
            <EventsFeed session={selectedSession} config={config} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ExamCard({ exam, onClick }: { exam: ExamSummary; onClick: () => void }) {
  return (
    <Card className="cursor-pointer transition-colors hover:border-primary" onClick={onClick}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate font-semibold">{exam.title}</h3>
            {exam.isOwner === false && (
              <p className="mt-0.5 text-xs text-muted-foreground">Shared with you by {exam.createdBy?.firstName}</p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {exam.myPermission && exam.myPermission !== 'OWNER' && (
              <Badge variant="secondary">{exam.myPermission}</Badge>
            )}
            <Badge variant={exam.status === 'LIVE' ? 'warning' : 'success'}>{exam.status}</Badge>
          </div>
        </div>
        <p className="mt-1 truncate text-sm text-muted-foreground">
          {(exam.courses?.map((ec) => ec.course.name).filter(Boolean).join(', ')) || exam.course?.name || 'No course'}
        </p>
        <div className="mt-4 grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-lg font-bold">{exam._count?.sessions ?? 0}</p>
            <p className="text-xs text-muted-foreground">Sessions</p>
          </div>
          <div>
            <p className="text-lg font-bold text-amber-600">{exam.monitoring?.violations ?? 0}</p>
            <p className="text-xs text-muted-foreground">Violations</p>
          </div>
          <div>
            <p className="text-lg font-bold text-emerald-600">{exam.monitoring?.submissions ?? 0}</p>
            <p className="text-xs text-muted-foreground">Submissions</p>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-center">
          <Button variant="ghost" size="sm" className="gap-1 text-xs">
            <Eye className="h-3.5 w-3.5" />
            View details
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function MonitorExamPage() {
  const [selectedExamId, setSelectedExamId] = useState<string | null>(null);
  const viewerRoleLabel = useViewerRoleLabel();

  const { data: exams, isLoading } = useQuery({
    queryKey: ['exams'],
    queryFn: () => examsService.list(),
  });

  const activeExams = (exams ?? []).filter((e) => e.status === 'LIVE' || e.status === 'PUBLISHED');
  const myExams = activeExams.filter((e) => e.isOwner !== false);
  const sharedExams = activeExams.filter((e) => e.isOwner === false);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="mt-2 h-4 w-96" />
          </div>
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="space-y-3 p-5">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (selectedExamId) {
    const exam = exams?.find((e) => e.id === selectedExamId);
    return (
      <MonitorDetail
        examId={selectedExamId}
        examTitle={exam?.title ?? 'Exam details'}
        access={{ isOwner: exam?.isOwner, myPermission: exam?.myPermission }}
        onBack={() => setSelectedExamId(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Monitor exam</h1>
          <p className="text-sm text-muted-foreground">
            Track live candidates, timers, focus events, AI signals and integrity violations in real time.
          </p>
        </div>
        <Badge variant="secondary">{viewerRoleLabel}</Badge>
      </div>

      {myExams.length === 0 && sharedExams.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
          <Monitor className="mb-3 h-12 w-12 text-muted-foreground" />
          <p className="text-lg font-medium">No active exams to monitor</p>
          <p className="mt-1 text-sm text-muted-foreground">Published or live exams will appear here.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {myExams.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">My exams</h2>
                <Badge variant="secondary">{myExams.length}</Badge>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {myExams.map((exam) => (
                  <ExamCard key={exam.id} exam={exam} onClick={() => setSelectedExamId(exam.id)} />
                ))}
              </div>
            </section>
          )}
          {sharedExams.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Shared with you</h2>
                <Badge variant="secondary">{sharedExams.length}</Badge>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {sharedExams.map((exam) => (
                  <ExamCard key={exam.id} exam={exam} onClick={() => setSelectedExamId(exam.id)} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
