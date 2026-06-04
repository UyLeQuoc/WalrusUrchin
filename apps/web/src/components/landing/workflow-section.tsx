import { CheckCircle2Icon } from "lucide-react"
import { motion } from "framer-motion"

import { Badge } from "@workspace/cores/components/badge"
import {
  Card,
  CardAction,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/cores/components/card"
import { workflowSteps } from "@/data/landing-page"
import { fadeUpVariants } from "@/components/landing/motion"
import { SectionHeading } from "@/components/landing/section-heading"

export function WorkflowSection() {
  return (
    <section
      id="workflow"
      className="relative overflow-hidden border-y border-border bg-muted/40 py-24 sm:py-28"
    >
      <div
        className="landing-scanlines absolute inset-0 opacity-30"
        aria-hidden="true"
      />
      <div className="relative mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-[0.82fr_1.18fr] lg:px-8">
        <SectionHeading
          className="lg:sticky lg:top-28 lg:self-start"
          eyebrow="Workflow"
          title="From profile to portable fan access in four steps"
          description="The homepage flow mirrors the eventual product path: creators publish encrypted membership content, fans buy access, and the entitlement remains verifiable."
        />

        <div className="relative grid gap-4">
          <div
            className="absolute top-8 bottom-8 left-5 w-px bg-border"
            aria-hidden="true"
          />
          {workflowSteps.map((item) => (
            <motion.div
              key={item.step}
              data-gsap="section-card"
              variants={fadeUpVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, margin: "-80px" }}
            >
              <Card className="rounded-[8px] border-border/70 bg-card/80 py-0 shadow-none backdrop-blur">
                <CardHeader className="gap-3 p-5">
                  <CardTitle className="flex items-center gap-3 text-xl font-black">
                    <CheckCircle2Icon
                      data-icon="inline-start"
                      aria-hidden="true"
                    />
                    {item.title}
                  </CardTitle>
                  <CardDescription>{item.description}</CardDescription>
                  <CardAction>
                    <Badge>{item.step}</Badge>
                  </CardAction>
                </CardHeader>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
