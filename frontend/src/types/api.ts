export type ApiEnvelope<T> = {
  success: boolean;
  data: T;
};

export type PaginatedResponse<T> = {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type RoleName = 'SUPER_ADMIN' | 'ADMIN' | 'INSTRUCTOR' | 'STUDENT';

export type AuthUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  avatarUrl?: string | null;
  status: string;
  emailVerifiedAt?: string | null;
  lastLoginAt?: string | null;
  createdAt: string;
  updatedAt: string;
  roles: RoleName[];
  permissions: string[];
};

export type Subject = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  createdAt: string;
};

export type Course = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  subjectId: string;
  subject?: Subject;
};

export type QuestionBank = {
  id: string;
  courseId: string;
  categoryId: string;
  createdById: string;
  name: string;
  description?: string | null;
  difficulty?: string | null;
  status: 'DRAFT' | 'PUBLISHED';
  createdAt: string;
  updatedAt: string;
  course?: Course;
  category?: Subject;
  createdBy?: { id: string; firstName: string; lastName: string; email: string };
  _count?: { questions: number };
};

export type QuestionBankDetail = QuestionBank & {
  questions: Question[];
  total: number;
  topics: string[];
};

export type QuestionBankPoolItem = {
  id: string;
  name: string;
  description?: string | null;
  courseId: string;
  categoryId: string;
  questionCount: number;
  questions: Question[];
};

export type QuestionPoolCourse = {
  course: {
    id: string;
    code: string;
    name: string;
    subject: { id: string; name: string };
  };
  banks: QuestionBankPoolItem[];
  standaloneQuestions: Question[];
};

export type ExamQuestionPool = {
  courses: QuestionPoolCourse[];
  totalQuestions: number;
};

export type QuestionOption = {
  id: string;
  label: string;
  text: string;
  sortOrder: number;
  isCorrect?: boolean;
};

export type Question = {
  id: string;
  subjectId: string;
  questionBankId?: string | null;
  createdById: string;
  type: string;
  difficulty: string;
  prompt: string;
  explanation?: string | null;
  points: number;
  negativePoints: number;
  tags: string;
  topic?: string | null;
  imageUrl?: string | null;
  sortOrder?: number;
  isActive: boolean;
  subject?: Subject;
  questionBank?: { id: string; name: string } | null;
  options: QuestionOption[];
  createdBy?: { id: string; firstName: string; lastName: string; email: string };
};

export type ContactMessage = {
  id: string;
  name: string;
  email: string;
  message: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type StudentMessage = {
  id: string;
  source: 'CONTACT' | 'EXAM_REPORT';
  name: string;
  email: string;
  message: string;
  status: 'NEW' | 'READ' | 'RESOLVED';
  createdAt: string;
  examId?: string;
  examTitle?: string;
  sessionId?: string;
  studentId?: string;
};

export type ExamSummary = {
  id: string;
  title: string;
  description?: string;
  instructions?: string;
  durationMinutes: number;
  totalMarks: number;
  passingMarks: number;
  startsAt: string;
  endsAt: string;
  status: string;
  attemptsAllowed: number;
  negativeMarkingRate: number;
  randomizeQuestions: boolean;
  randomizeOptions: boolean;
  fullscreenRequired: boolean;
  showResultImmediately: boolean;
  course?: { name: string; subject?: { name: string } };
  courses?: Array<{ id: string; course: Course }>;
  questionBank?: { id: string; name: string } | null;
  questionBanks?: Array<{ id: string; questionBank: { id: string; name: string } }>;
  createdBy?: { id: string; firstName: string; lastName: string; email: string };
  _count?: { questions: number; sessions: number; assignments: number };
  monitoring?: { violations: number; submissions: number };
  isOwner?: boolean;
  myPermission?: 'OWNER' | 'VIEWER' | 'MONITOR' | 'PROCTOR' | 'CO_OWNER' | null;
  shares?: Array<{ id: string; firstName: string; lastName: string; email: string; permissionLevel?: string; grantedBy?: string }>;
};

export type ExamDetail = ExamSummary & {
  questions: ExamQuestion[];
  assignments?: Array<{
    id: string;
    student: { id: string; firstName: string; lastName: string; email: string };
  }>;
};

export type ExamQuestion = {
  id: string;
  questionId: string;
  points: number;
  sortOrder: number;
  question: Question;
};

export type ExamSession = {
  id: string;
  examId: string;
  studentId: string;
  remainingSeconds?: number;
  status: string;
  exam: ExamDetail;
  answers: Array<{
    questionId: string;
    selectedOptionIds: string;
    answerText?: string;
    isBookmarked: boolean;
  }>;
  violations: Array<{ id: string; type: string; severity: number }>;
};

export type User = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  avatarUrl?: string | null;
  status: string;
  emailVerifiedAt?: string | null;
  lastLoginAt?: string | null;
  createdAt: string;
  roles: Array<{ role: { name: RoleName } }>;
};

export type Role = {
  id: string;
  name: RoleName;
  description?: string | null;
  rolePermissions: Array<{ permission: { id: string; key: string; label: string } }>;
};

export type Permission = {
  id: string;
  key: string;
  label: string;
  module: string;
};

export type Notification = {
  id: string;
  type: string;
  title: string;
  message: string;
  readAt?: string | null;
  createdAt: string;
};

export type Certificate = {
  id: string;
  certificateNo: string;
  verificationCode: string;
  fileUrl?: string | null;
  issuedAt: string;
  result?: { score: number; percentage: number; grade?: string; exam: { title: string } };
};

export type Result = {
  id: string;
  score: number;
  maxScore: number;
  percentage: number;
  grade?: string | null;
  passed: boolean;
  feedback?: string | null;
  publishedAt?: string | null;
  createdAt: string;
  exam: { title: string; course: { name: string; subject: { name: string } } };
  certificate?: Certificate | null;
  submission?: {
    session?: {
      student?: { id: string; firstName: string; lastName: string; email: string };
    };
  };
};

export type ResultDetail = Result & {
  exam: ExamDetail;
  submission: {
    session: {
      answers: Array<{
        id: string;
        questionId: string;
        selectedOptionIds: string;
        answerText?: string;
        score?: number;
        feedback?: string;
        question: Question;
        grader?: { id: string; firstName: string; lastName: string };
      }>;
    };
  };
};

export type SessionHistory = {
  id: string;
  status: string;
  attemptNumber: number;
  startedAt?: string | null;
  submittedAt?: string | null;
  score?: number;
  percentage?: number;
  exam: { title: string };
};

export type AuditLog = {
  id: string;
  action: string;
  entity: string;
  entityId?: string | null;
  ipAddress?: string | null;
  createdAt: string;
  actor?: { id: string; email: string; firstName: string; lastName: string } | null;
};
