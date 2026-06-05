import { CirclePlayIcon, ShieldCheckIcon } from "lucide-react"
import { motion } from "framer-motion"

import { Badge } from "@workspace/cores/components/badge"
import { Button } from "@workspace/cores/components/button"
import { heroMetrics } from "@/data/landing-page"
import { WalletConnectButton } from "@/components/wallet/wallet-connect-button"
import {
  fadeUpVariants,
  staggerContainerVariants,
} from "@/components/landing/motion"

const heroTitleLines = ["Walrus", "Urchin"]

const spineAngles = Array.from({ length: 32 }, (_, index) => index * 11.25)

function AnimatedWalrusUrchin() {
  return (
    <div
      className="relative mx-auto grid min-h-[420px] w-full max-w-xl place-items-center lg:min-h-[620px]"
      data-gsap="hero-stage"
    >
      <div
        className="absolute inset-x-10 top-1/2 h-48 -translate-y-1/2 rounded-full bg-primary/10 blur-3xl"
        aria-hidden="true"
      />
      <svg
        className="relative aspect-square w-full max-w-[34rem] text-foreground"
        viewBox="0 0 600 600"
        role="img"
        aria-label="Animated WalrusUrchin mark"
      >
        <g data-gsap="urchin-shell">
          {spineAngles.map((angle) => {
            const radians = (angle * Math.PI) / 180
            const innerX = 300 + Math.cos(radians) * 142
            const innerY = 300 + Math.sin(radians) * 142
            const outerX = 300 + Math.cos(radians) * 252
            const outerY = 300 + Math.sin(radians) * 252

            return (
              <line
                key={angle}
                data-gsap="urchin-spine"
                x1={innerX}
                y1={innerY}
                x2={outerX}
                y2={outerY}
                stroke="currentColor"
                strokeLinecap="round"
                strokeWidth="8"
                className="text-primary"
              />
            )
          })}
          <circle
            cx="300"
            cy="300"
            r="158"
            fill="currentColor"
            className="text-primary"
            opacity="0.12"
          />
        </g>

        <g data-gsap="urchin-body">
          <circle
            cx="300"
            cy="300"
            r="126"
            fill="currentColor"
            className="text-card"
          />
          <circle
            cx="300"
            cy="300"
            r="126"
            fill="none"
            stroke="currentColor"
            strokeWidth="10"
            className="text-primary"
          />
          <ellipse
            cx="300"
            cy="326"
            rx="82"
            ry="54"
            fill="currentColor"
            className="text-muted"
          />
          <circle
            cx="258"
            cy="278"
            r="13"
            fill="currentColor"
            className="text-foreground"
          />
          <circle
            cx="342"
            cy="278"
            r="13"
            fill="currentColor"
            className="text-foreground"
          />
          <circle
            cx="264"
            cy="274"
            r="4"
            fill="currentColor"
            className="text-background"
          />
          <circle
            cx="348"
            cy="274"
            r="4"
            fill="currentColor"
            className="text-background"
          />
          <path
            d="M286 317c8 7 20 7 28 0"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="7"
            className="text-foreground"
          />
          <path
            data-gsap="urchin-tusk"
            d="M270 344c-3 43 9 78 30 106 21-28 33-63 30-106"
            fill="currentColor"
            className="text-foreground"
          />
          <path
            d="M300 348v92"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="4"
            className="text-border"
          />
          <g
            data-gsap="urchin-whiskers"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="5"
            className="text-muted-foreground"
          >
            <path d="M244 322c-40-6-73-1-99 14" />
            <path d="M250 340c-38 11-67 29-87 55" />
            <path d="M356 322c40-6 73-1 99 14" />
            <path d="M350 340c38 11 67 29 87 55" />
          </g>
        </g>

        <g
          data-gsap="orbit-ring"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          className="text-primary"
        >
          <circle cx="300" cy="300" r="220" strokeDasharray="16 26" />
        </g>
      </svg>
    </div>
  )
}

export function HeroSection() {
  return (
    <section
      id="top"
      className="relative isolate overflow-hidden border-b border-border bg-background"
    >
      <div
        className="landing-grid absolute inset-0 opacity-40"
        aria-hidden="true"
      />
      <div
        className="landing-scanlines absolute inset-0 opacity-30"
        aria-hidden="true"
      />
      <div className="relative mx-auto grid min-h-[calc(100svh-4.5rem)] max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[1.02fr_0.98fr] lg:px-8">
        <motion.div
          className="max-w-4xl"
          variants={staggerContainerVariants}
          initial="hidden"
          animate="visible"
        >
          <motion.div
            className="mb-6"
            data-gsap="hero-badge"
            variants={fadeUpVariants}
          >
            <Badge
              className="border-primary/40 bg-primary/10 text-primary"
              variant="outline"
            >
              <ShieldCheckIcon data-icon="inline-start" aria-hidden="true" />
              Sui testnet first. Creator ownership by design.
            </Badge>
          </motion.div>

          <motion.h1
            aria-label="WalrusUrchin"
            className="text-6xl leading-[0.86] font-black tracking-normal text-foreground uppercase sm:text-7xl lg:text-8xl"
            variants={fadeUpVariants}
          >
            {heroTitleLines.map((line) => (
              <span key={line} className="block overflow-hidden">
                <span
                  className={
                    line === "Urchin" ? "mt-2 block w-fit" : "block w-fit"
                  }
                >
                  {Array.from(line).map((letter, index) => (
                    <span
                      key={`${line}-${letter}-${index}`}
                      aria-hidden="true"
                      className="inline-block"
                      data-gsap="hero-letter"
                    >
                      {letter}
                    </span>
                  ))}
                </span>
              </span>
            ))}
          </motion.h1>

          <motion.p
            className="mt-7 max-w-2xl text-lg leading-8 text-pretty text-muted-foreground sm:text-xl"
            data-gsap="hero-copy"
            variants={fadeUpVariants}
          >
            A decentralized creator membership layer on Sui where creators own
            identity, encrypted content, transparent payouts, and portable fan
            access.
          </motion.p>

          <motion.div
            className="mt-8 flex flex-col gap-3 sm:flex-row"
            data-gsap="hero-actions"
            variants={fadeUpVariants}
          >
            <WalletConnectButton size="lg" />
            <Button asChild size="lg" variant="outline">
              <a href="#workflow">
                <CirclePlayIcon data-icon="inline-start" aria-hidden="true" />
                See workflow
              </a>
            </Button>
          </motion.div>

          <motion.dl
            className="mt-10 grid max-w-3xl grid-cols-1 gap-3 sm:grid-cols-3"
            variants={fadeUpVariants}
          >
            {heroMetrics.map((metric) => (
              <div
                key={metric.label}
                className="rounded-[8px] border border-border bg-card/70 p-4 backdrop-blur"
              >
                <dt className="text-xs leading-5 font-medium text-muted-foreground uppercase">
                  {metric.label}
                </dt>
                <dd className="mt-2 text-2xl leading-none font-black text-primary">
                  {metric.value}
                </dd>
              </div>
            ))}
          </motion.dl>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.97, y: 28 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.85, ease: "easeOut" }}
        >
          <AnimatedWalrusUrchin />
        </motion.div>
      </div>
    </section>
  )
}
