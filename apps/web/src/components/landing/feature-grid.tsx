import type { LucideIcon } from "lucide-react"
import {
  FingerprintIcon,
  LockKeyholeIcon,
  ReceiptTextIcon,
  SparklesIcon,
} from "lucide-react"
import { motion } from "framer-motion"

import { Badge } from "@workspace/cores/components/badge"
import { cn } from "@workspace/cores/lib/utils"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/cores/components/card"
import { featureCards, type FeatureIcon } from "@/data/landing-page"
import { fadeUpVariants } from "@/components/landing/motion"
import { SectionHeading } from "@/components/landing/section-heading"

const featureIcons = {
  identity: FingerprintIcon,
  onboarding: SparklesIcon,
  payout: ReceiptTextIcon,
  storage: LockKeyholeIcon,
} satisfies Record<FeatureIcon, LucideIcon>

const featureStyles = {
  identity: {
    icon: "bg-primary/10 text-primary",
    line: "bg-primary",
  },
  onboarding: {
    icon: "bg-chart-4/10 text-chart-4",
    line: "bg-chart-4",
  },
  payout: {
    icon: "bg-chart-2/10 text-chart-2",
    line: "bg-chart-2",
  },
  storage: {
    icon: "bg-chart-3/10 text-chart-3",
    line: "bg-chart-3",
  },
} satisfies Record<FeatureIcon, { icon: string; line: string }>

export function FeatureGrid() {
  return (
    <section
      id="creators"
      className="relative isolate overflow-hidden bg-background py-24 sm:py-28"
    >
      <div
        className="landing-grid absolute inset-0 opacity-25"
        aria-hidden="true"
      />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Creator-owned memberships"
          title="A cleaner way to sell access without renting the audience"
          description="WalrusUrchin moves the core creator economy objects onto Sui while keeping the first user experience simple, fast, and familiar."
        />

        <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {featureCards.map((feature) => {
            const Icon = featureIcons[feature.icon]
            const style = featureStyles[feature.icon]

            return (
              <motion.div
                key={feature.title}
                data-gsap="section-card"
                variants={fadeUpVariants}
                initial="hidden"
                whileInView="visible"
                whileHover={{ y: -5 }}
                viewport={{ once: true, margin: "-80px" }}
              >
                <Card className="h-full rounded-[8px] border-border/70 bg-card/75 py-0 shadow-none backdrop-blur transition-colors hover:border-primary/60">
                  <div className={cn("h-1", style.line)} />
                  <CardHeader className="gap-5 p-5">
                    <div className="flex items-center justify-between gap-4">
                      <span
                        className={cn(
                          "grid size-11 place-items-center rounded-[8px]",
                          style.icon
                        )}
                      >
                        <Icon className="size-5" aria-hidden="true" />
                      </span>
                      <Badge variant="outline">Feature</Badge>
                    </div>
                    <div className="flex flex-col gap-3">
                      <CardTitle className="text-xl font-black">
                        {feature.title}
                      </CardTitle>
                      <CardDescription className="leading-6">
                        {feature.description}
                      </CardDescription>
                    </div>
                  </CardHeader>
                </Card>
              </motion.div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
