import Link from 'next/link';
import { ArrowLeft, Mail, MessageSquareText } from 'lucide-react';
import { PublicNav } from '@/components/layout/public-nav';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { GraduationCap } from 'lucide-react';

const TEAM_EMAIL = 'tsdat@gmail.com';

const items = [
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
    content: 'Enterprise support with dedicated account managers, SLAs, and regular platform health reviews.',
  },
];

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-background">
      <PublicNav />
      <main className="container py-16">
        <Button asChild variant="ghost" size="sm" className="mb-8">
          <Link href="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to home
          </Link>
        </Button>
        <div className="mx-auto max-w-3xl">
          <h1 className="text-4xl font-bold tracking-tight">Contact the tsdat team</h1>
          <p className="mt-4 text-lg leading-8 text-muted-foreground">
            Plan deployment, data migration, identity integration, and proctoring extensions for your institution.
          </p>
        </div>

        {/* Primary contact card */}
        <div className="mx-auto mt-10 max-w-3xl">
          <Card className="flex flex-col gap-4 border-border/60 bg-card/60 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/12 text-primary">
                <Mail className="h-6 w-6" />
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">Email the tsdat team</p>
                <a
                  href={`mailto:${TEAM_EMAIL}`}
                  className="text-base font-medium text-primary hover:underline"
                >
                  {TEAM_EMAIL}
                </a>
              </div>
            </div>
            <Button asChild size="sm" className="shrink-0 bg-primary hover:bg-primary/90">
              <a href={`mailto:${TEAM_EMAIL}`}>
                <MessageSquareText className="mr-2 h-4 w-4" />
                Send a message
              </a>
            </Button>
          </Card>
        </div>

        <div className="mx-auto mt-12 grid max-w-4xl gap-6 md:grid-cols-3">
          {items.map((item) => (
            <Card key={item.title} className="flex flex-col">
              <CardHeader>
                <CardTitle className="text-lg">{item.title}</CardTitle>
              </CardHeader>
              <CardContent className="flex-1">
                <p className="text-sm leading-6 text-muted-foreground">{item.content}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
      <Separator />
      <footer className="py-8">
        <div className="container flex flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <GraduationCap className="h-4 w-4 text-primary" />
            OES — Online Examination System
          </div>
          <p className="text-xs text-muted-foreground">&copy; {new Date().getFullYear()} OES. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}