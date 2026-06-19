import { PublicPage } from '@/features/landing/public-page';

export default function PricingPage() {
  return (
    <PublicPage
      title="Pricing for every institution"
      description="Support single schools, multi-campus universities, certification providers, and enterprise training programs with flexible plans."
      items={[
        {
          title: 'School',
          content: 'Ideal for K-12 schools. Includes up to 500 candidates, basic monitoring, and auto-grading. Custom branding available.',
        },
        {
          title: 'University',
          content: 'Built for higher education. Supports 5,000+ candidates, advanced proctoring, department-level analytics, and LMS integration.',
        },
        {
          title: 'Enterprise',
          content: 'For certification bodies and large deployments. Unlimited candidates, dedicated support, on-premise deployment, and SLA guarantees.',
        },
      ]}
    />
  );
}
