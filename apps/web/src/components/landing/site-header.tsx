import { ArrowRightIcon, ShieldCheckIcon } from "lucide-react"
import { motion } from "framer-motion"

import { Button } from "@workspace/cores/components/button"
import { navItems } from "@/data/landing-page"
import { ModeToggle } from "@/components/mode-toggle"

export function SiteHeader() {
  return (
    <motion.header
      className="sticky top-0 z-30 border-b border-border/70 bg-background/80 backdrop-blur-xl"
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
    >
      <div className="mx-auto flex h-[4.5rem] max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <a
          className="flex min-w-0 items-center gap-3"
          href="#top"
          aria-label="WalrusUrchin home"
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-[8px] bg-primary text-primary-foreground">
            <ShieldCheckIcon aria-hidden="true" />
          </span>
          <span className="truncate text-base font-black">WalrusUrchin</span>
        </a>

        <nav
          className="hidden items-center gap-1 rounded-full border border-border bg-muted/50 p-1 text-sm text-muted-foreground md:flex"
          aria-label="Main navigation"
        >
          {navItems.map((item) => (
            <a
              key={item.href}
              className="rounded-full px-3 py-1.5 transition-colors hover:bg-secondary hover:text-foreground"
              href={item.href}
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <ModeToggle />
          <Button asChild className="rounded-[8px]" size="lg">
            <a href="#join">
              Start now
              <ArrowRightIcon data-icon="inline-end" aria-hidden="true" />
            </a>
          </Button>
        </div>
      </div>
    </motion.header>
  )
}
