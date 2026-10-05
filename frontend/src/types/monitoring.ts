export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type ConnectionState = 'CONNECTED' | 'DISCONNECTED' | 'RECONNECTING';
export type WebcamMode = 'DISABLED' | 'OPTIONAL' | 'REQUIRED';
export type MicMode = 'DISABLED' | 'OPTIONAL' | 'REQUIRED';
export type FullscreenPolicy = 'DISABLED' | 'OPTIONAL' | 'REQUIRED';
export type MonitoringStrictness = 'RELAXED' | 'STANDARD' | 'STRICT';

export interface SessionSnapshot {
  sessionId: string;
  examId: string;
  studentId: string;
  student: { id: string; firstName: string; lastName: string; email: string };
  status: string;
  connectionState: ConnectionState;
  startedAt: string | null;
  submittedAt: string | null;
  expiresAt: string | null;
  /**
   * Deadline the session started with, captured the first time time was granted.
   * Present so staff can see what a candidate's allowance was before extensions.
   */
  originalExpiresAt?: string | null;
  /** Running total of minutes granted so far. */
  totalExtensionMinutes?: number;
  /**
   * Authoritative remaining time, derived server-side from `expiresAt`. Preferred
   * over `remainingSeconds`, which is a client-written snapshot.
   */
  serverRemainingSeconds?: number | null;
  remainingSeconds: number | null;
  lastHeartbeatAt: string | null;
  lastActivityAt: string | null;
  currentQuestionId: string | null;
  currentQuestionIndex: number | null;
  answeredCount: number;
  totalQuestions: number;
  unansweredCount: number;
  flaggedCount: number;
  progress: number;
  riskScore: number;
  riskLevel: RiskLevel;
  violationsCount: number;
  reportCount: number;
  resumeApprovalRequired: boolean;
  resumeApprovedAt: string | null;
  resumeDeniedAt: string | null;
  resumePending: boolean;
}

/**
 * One row of the time-extension audit trail, written by the backend for every
 * grant it applies. Append-only: an extension never edits an earlier record.
 */
export interface TimeExtensionRecord {
  id: string;
  sessionId: string;
  examId: string;
  studentId: string;
  minutes: number;
  previousExpiresAt: string | null;
  newExpiresAt: string;
  totalExtensionMinutes: number;
  reason: string | null;
  createdAt: string;
  grantedBy?: { id: string; firstName: string; lastName: string; email: string } | null;
  student?: { id: string; firstName: string; lastName: string; email: string } | null;
}

/** Server's authoritative deadline for a session. */
export interface SessionDeadline {
  sessionId: string;
  examId: string;
  status: string;
  startedAt: string | null;
  originalExpiresAt: string | null;
  expiresAt: string | null;
  totalExtensionMinutes: number;
  submittedAt: string | null;
  remainingSeconds: number | null;
}

export interface LiveStats {
  examId: string;
  total: number;
  active: number;
  online: number;
  submitted: number;
  atRisk: number;
  warning: number;
  critical: number;
  disconnected: number;
  avgCompletion: number;
  avgRemainingSeconds: number;
  submissionRate: number;
  connectionFailures: number;
  suspiciousEvents: number;
  thresholds: Record<string, number>;
}

export interface MonitorConfig {
  webcamEnabled: boolean;
  micEnabled: boolean;
  screenMonitoring: boolean;
  recordingEnabled: boolean;
  aiDetectionEnabled: boolean;
  eventLoggingEnabled: boolean;
  requireConsent: boolean;
  webcamMode: WebcamMode;
  micMode: MicMode;
  fullscreenPolicy: FullscreenPolicy;
  trackTabSwitches: boolean;
  trackWindowBlur: boolean;
  disableCopy: boolean;
  disablePaste: boolean;
  detectClipboard: boolean;
  detectShortcuts: boolean;
  violationThreshold: number;
  strictness: MonitoringStrictness;
  weights: Record<string, number>;
  thresholds: Record<string, number>;
}

export interface StudentRequirements {
  examId: string;
  webcamEnabled: boolean;
  micEnabled: boolean;
  screenMonitoring: boolean;
  recordingEnabled: boolean;
  aiDetectionEnabled: boolean;
  eventLoggingEnabled: boolean;
  requireConsent: boolean;
  webcamMode: WebcamMode;
  micMode: MicMode;
  fullscreenPolicy: FullscreenPolicy;
  trackTabSwitches: boolean;
  trackWindowBlur: boolean;
  disableCopy: boolean;
  disablePaste: boolean;
  detectClipboard: boolean;
  detectShortcuts: boolean;
  violationThreshold: number;
  strictness: MonitoringStrictness;
}

export interface MonitoringEvent {
  id: string;
  kind?: 'event' | 'violation';
  type: string;
  timestamp: string;
  riskScore?: number;
  severity?: string | number;
  metadata?: unknown;
  acknowledgedAt?: string | null;
  acknowledgedBy?: string | null;
  note?: string | null;
  student?: { firstName: string; lastName: string; email: string };
}

export interface MonitorAlert {
  studentId: string;
  student: string;
  type: string;
  severity: string;
  message: string;
  timestamp: string;
}

export type InstructorAction =
  | 'warning'
  | 'message'
  | 'pause'
  | 'resume'
  | 'extend'
  | 'force_submit'
  | 'disconnect'
  | 'note'
  | 'approve_resume'
  | 'deny_resume';
