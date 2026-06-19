import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { PublicNav } from '@/components/layout/public-nav';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { GraduationCap } from 'lucide-react';

type PublicPageProps = {
  title: string;
  description: string;
  items: Array<{ title: string; content: string }>;
};

export function PublicPage({ title, description, items }: PublicPageProps) {
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
          <h1 className="text-4xl font-bold tracking-tight">{title}</h1>
          <p className="mt-4 text-lg leading-8 text-muted-foreground">{description}</p>
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
