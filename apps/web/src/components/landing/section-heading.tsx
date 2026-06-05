import type { ReactNode } from "react"
import { motion } from "framer-motion"

import { Badge } from "@workspace/cores/components/badge"
import { cn } from "@workspace/cores/lib/utils"
import {
  fadeUpVariants,
  staggerContainerVariants,
} from "@/components/landing/motion"

type SectionHeadingProps = {
  eyebrow: string
  title: string
  description: ReactNode
  className?: string
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  className,
}: SectionHeadingProps) {
  return (
    <motion.div
      className={cn("max-w-4xl", className)}
      variants={staggerContainerVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-80px" }}
    >
      <motion.div variants={fadeUpVariants}>
        <Badge
          className="border-primary/40 bg-primary/10 text-primary"
          variant="outline"
        >
          {eyebrow}
        </Badge>
      </motion.div>
      <motion.h2
        className="mt-4 text-4xl leading-[0.98] font-black text-balance text-foreground sm:text-5xl lg:text-6xl"
        variants={fadeUpVariants}
      >
        {title}
      </motion.h2>
      <motion.p
        className="mt-5 max-w-2xl text-base leading-7 text-pretty text-muted-foreground sm:text-lg"
        variants={fadeUpVariants}
      >
        {description}
      </motion.p>
    </motion.div>
  )
}
