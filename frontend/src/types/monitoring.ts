export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type ConnectionState = 'CONNECTED' | 'DISCONNECTED' | 'RECONNECTING';

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
  | 'note';
