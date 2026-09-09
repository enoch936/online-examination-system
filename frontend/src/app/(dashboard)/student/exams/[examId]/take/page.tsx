import { use } from 'react';
import { ExamTakingClient } from '@/features/exams/exam-taking-client';

export default function TakeExamPage({ params }: { params: Promise<{ examId: string }> }) {
  const { examId } = use(params);
  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-background px-4 py-6 sm:px-8">
      <ExamTakingClient examId={examId} />
    </div>
  );
}
