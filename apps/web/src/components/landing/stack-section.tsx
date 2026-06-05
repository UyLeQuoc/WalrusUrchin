import { ArrowRightIcon } from "lucide-react"
import { motion } from "framer-motion"

import { Badge } from "@workspace/cores/components/badge"
import { Button } from "@workspace/cores/components/button"
import { stackItems } from "@/data/landing-page"
import { fadeUpVariants } from "@/components/landing/motion"
import { SectionHeading } from "@/components/landing/section-heading"

export function StackSection() {
  return (
    <section id="stack" className="bg-background py-24 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-12">
          <SectionHeading
            eyebrow="Sui stack"
            title="Trust boundary stays small, access stays composable"
            description="The browser builds user-owned transactions and decrypts content. The Hono API exists only for secrets such as gas sponsorship, Harbor grants, and memwal delegation."
          />

          <div className="grid gap-3">
            {stackItems.map((item) => (
              <motion.article
                key={item.name}
                data-gsap="section-card"
                className="group grid gap-5 rounded-[8px] border border-border bg-card/70 p-5 backdrop-blur transition-colors hover:border-primary/60 sm:grid-cols-[0.32fr_1fr_auto] sm:items-center"
                variants={fadeUpVariants}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-80px" }}
              >
                <div>
                  <Badge variant="outline">{item.role}</Badge>
                  <h3 className="mt-3 text-3xl leading-none font-black text-foreground">
                    {item.name}
                  </h3>
                </div>
                <p className="max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
                  {item.detail}
                </p>
                <Button
                  asChild
                  className="sm:justify-self-end"
                  size="sm"
                  variant="outline"
                >
                  <a href="#join">
                    Connect
                    <ArrowRightIcon data-icon="inline-end" aria-hidden="true" />
                  </a>
                </Button>
              </motion.article>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
