import { PublicPage } from '@/features/landing/public-page';

export default function ContactPage() {
  return (
    <PublicPage
      title="Contact implementation team"
      description="Plan deployment, data migration, identity integration, and proctoring extensions for your institution."
      items={[
        {
          title: 'Deployment planning',
          content: 'Our team helps you plan cloud or on-premise deployment, including infrastructure sizing, network configuration, and rollout strategy.',
        },
        {
          title: 'Identity integration',
          content: 'Seamless integration with SAML, LDAP, OAuth, and major LMS platforms including Canvas, Blackboard, and Moodle.',
        },
        {
          title: 'Support operations',
          content: '24/7 enterprise support with dedicated account managers, SLAs, and regular platform health reviews.',
        },
      ]}
    />
  );
}
