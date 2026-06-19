import { ExamTakingClient } from '@/features/exams/exam-taking-client';

export default function ResumeExamPage({ params }: { params: { examId: string } }) {
  return <ExamTakingClient sessionId={params.examId} />;
}
