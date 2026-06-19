import { PublicPage } from '@/features/landing/public-page';

export default function AboutPage() {
  return (
    <PublicPage
      title="Built for academic operations"
      description="OES brings exam authoring, candidate delivery, realtime monitoring, grading, reporting, and audit trails into one institution-ready platform."
      items={[
        {
          title: 'Multi-role workflows',
          content: 'Admins control policies, instructors create and grade exams, students take assessments — all with role-specific dashboards and permissions.',
        },
        {
          title: 'Exam integrity',
          content: 'Browser lockdown, identity verification, randomised questions, and anomaly detection ensure every result is trustworthy.',
        },
        {
          title: 'Result lifecycle',
          content: 'Auto-grading, manual review, curve adjustments, and certificate generation streamline the entire results workflow.',
        },
      ]}
    />
  );
}
