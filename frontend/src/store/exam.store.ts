'use client';

import { create } from 'zustand';

type AnswerDraft = {
  questionId: string;
  selectedOptionIds: string[];
  answerText?: string;
  isBookmarked?: boolean;
  isMarkedForReview?: boolean;
};

type ExamState = {
  currentIndex: number;
  answers: Record<string, AnswerDraft>;
  setCurrentIndex: (index: number) => void;
  updateAnswer: (answer: AnswerDraft) => void;
  toggleBookmark: (questionId: string) => void;
  reset: () => void;
};

export const useExamStore = create<ExamState>((set) => ({
  currentIndex: 0,
  answers: {},
  setCurrentIndex: (currentIndex) => set({ currentIndex }),
  updateAnswer: (answer) =>
    set((state) => ({
      answers: {
        ...state.answers,
        [answer.questionId]: {
          ...state.answers[answer.questionId],
          ...answer,
        },
      },
    })),
  toggleBookmark: (questionId) =>
    set((state) => ({
      answers: {
        ...state.answers,
        [questionId]: {
          ...state.answers[questionId],
          questionId,
          selectedOptionIds: state.answers[questionId]?.selectedOptionIds ?? [],
          isBookmarked: !state.answers[questionId]?.isBookmarked,
        },
      },
    })),
  reset: () => set({ currentIndex: 0, answers: {} }),
}));
