import { MotionConfig } from "framer-motion"

import { CtaSection } from "@/components/landing/cta-section"
import { FeatureGrid } from "@/components/landing/feature-grid"
import { HeroSection } from "@/components/landing/hero-section"
import { LandingMetrics } from "@/components/landing/landing-metrics"
import { SiteHeader } from "@/components/landing/site-header"
import { StackSection } from "@/components/landing/stack-section"
import { WorkflowSection } from "@/components/landing/workflow-section"
import { useGsapLandingPage } from "@/hooks/use-gsap-landing-page"

export function HomePage() {
  const pageRef = useGsapLandingPage()

  return (
    <MotionConfig reducedMotion="user">
      <div
        ref={pageRef}
        className="min-h-svh overflow-x-clip bg-background text-foreground selection:bg-primary selection:text-primary-foreground"
      >
        <SiteHeader />
        <main>
          <HeroSection />
          <LandingMetrics />
          <FeatureGrid />
          <WorkflowSection />
          <StackSection />
          <CtaSection />
        </main>
      </div>
    </MotionConfig>
  )
}
