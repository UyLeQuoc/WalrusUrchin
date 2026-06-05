import { BoxesIcon } from "lucide-react"
import { motion } from "framer-motion"

import { Badge } from "@workspace/cores/components/badge"
import { Button } from "@workspace/cores/components/button"
import { WalletConnectButton } from "@/components/wallet/wallet-connect-button"
import {
  fadeUpVariants,
  staggerContainerVariants,
} from "@/components/landing/motion"

export function CtaSection() {
  return (
    <section
      id="join"
      className="relative overflow-hidden border-t border-border bg-primary py-20 text-primary-foreground sm:py-24"
    >
      <div
        className="landing-grid absolute inset-0 opacity-25"
        aria-hidden="true"
      />
      <motion.div
        className="relative mx-auto flex max-w-7xl flex-col gap-8 px-4 sm:px-6 lg:flex-row lg:items-end lg:justify-between lg:px-8"
        variants={staggerContainerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-80px" }}
      >
        <div className="max-w-4xl">
          <motion.div variants={fadeUpVariants}>
            <Badge
              className="bg-background text-foreground"
              variant="secondary"
            >
              Ready for testnet
            </Badge>
          </motion.div>
          <motion.h2
            className="mt-4 text-5xl leading-[0.95] font-black text-balance sm:text-6xl lg:text-7xl"
            variants={fadeUpVariants}
          >
            Launch creator access that moves with the audience.
          </motion.h2>
          <motion.p
            className="mt-5 max-w-2xl text-base leading-7 text-primary-foreground/75 sm:text-lg"
            variants={fadeUpVariants}
          >
            Start from the scaffold, keep secrets in the Hono API, and make the
            frontend a polished Sui-native experience for creators and fans.
          </motion.p>
        </div>

        <motion.div
          className="flex flex-col gap-3 sm:flex-row lg:shrink-0"
          variants={fadeUpVariants}
        >
          <WalletConnectButton size="lg" variant="secondary" />
          <Button asChild size="lg" variant="outline">
            <a href="#stack">
              <BoxesIcon data-icon="inline-start" aria-hidden="true" />
              View stack
            </a>
          </Button>
        </motion.div>
      </motion.div>
    </section>
  )
}
