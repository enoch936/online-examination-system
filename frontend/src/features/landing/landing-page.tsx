import { LandingNav } from './landing-nav';
import { LandingHero } from './landing-hero';
import { CapabilitiesStrip, BentoSection } from './landing-bento';
import { LandingInterlude } from './landing-interlude';
import { LifecycleSection } from './landing-lifecycle';
import { NarrativeSection } from './landing-narrative';
import { RolesSection } from './landing-roles';
import { ArchitectureSection } from './landing-architecture';
import { SecuritySection } from './landing-cta';
import { CTASection } from './landing-cta';
import { LandingFooter } from './landing-footer';

export function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-x-clip bg-background text-foreground selection:bg-primary/30">
      <LandingNav />
      <main>
        <LandingHero />
        <CapabilitiesStrip />
        <BentoSection />
        <LandingInterlude />
        <LifecycleSection />
        <RolesSection />
        <ArchitectureSection />
        <NarrativeSection />
        <SecuritySection />
        <CTASection />
      </main>
      <LandingFooter />
    </div>
  );
}