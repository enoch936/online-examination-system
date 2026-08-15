import { PublicPage } from '@/features/landing/public-page';

export default function FaqPage() {
  return (
    <PublicPage
      title="Frequently asked questions"
      description="Answers for exam security, autosave, reporting, deployment, and institution-level administration."
      items={[
        {
          title: 'Security',
          content: 'All data is encrypted at rest and in transit. We support SSO, MFA, role-based access, and full audit logging for compliance.',
        },
        {
          title: 'Scalability',
          content: 'Built on cloud-native architecture. Handles thousands of concurrent exam sessions with automatic scaling and load balancing.',
        },
        {
          title: 'Reporting',
          content: 'Generate custom reports on candidate performance, question analysis, integrity flags, and institutional trends. Export to PDF, CSV, or LMS.',
        },
      ]}
    />
  );
}
