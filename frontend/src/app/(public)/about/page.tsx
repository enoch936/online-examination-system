import type { Metadata } from 'next';
import { AboutPage } from '@/features/landing/about-page';

export const metadata: Metadata = {
  title: 'About OES — Online Examination System',
  description:
    'OES is an examination platform for institutions that have to defend their results: authoring, delivery, live proctoring, grading, reporting and certification with role-scoped workspaces and a full audit trail.',
};

export default function Page() {
  return <AboutPage />;
}
