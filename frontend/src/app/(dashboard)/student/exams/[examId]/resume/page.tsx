import { use } from 'react';
import { ExamTakingClient } from '@/features/exams/exam-taking-client';

export default function ResumeExamPage({ params }: { params: Promise<{ examId: string }> }) {
  const { examId } = use(params);
  return <ExamTakingClient sessionId={examId} />;
}
