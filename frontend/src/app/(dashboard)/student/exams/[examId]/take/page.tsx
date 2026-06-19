import { ExamTakingClient } from '@/features/exams/exam-taking-client';

export default function TakeExamPage({ params }: { params: { examId: string } }) {
  return <ExamTakingClient examId={params.examId} />;
}
