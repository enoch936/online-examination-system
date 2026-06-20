import { use } from 'react';
import { ExamTakingClient } from '@/features/exams/exam-taking-client';

export default function TakeExamPage({ params }: { params: Promise<{ examId: string }> }) {
  const { examId } = use(params);
  return <ExamTakingClient examId={examId} />;
}
