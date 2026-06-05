import { motion } from "framer-motion"

import { Logo } from "@/components/logo"
import { navItems } from "@/data/landing-page"
import { ModeToggle } from "@/components/mode-toggle"
import { WalletConnectButton } from "@/components/wallet/wallet-connect-button"

export function SiteHeader() {
  return (
    <motion.header
      className="sticky top-0 z-30 border-b border-border/70 bg-background/80 backdrop-blur-xl"
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
    >
      <div className="mx-auto flex h-[4.5rem] max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Logo />

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
          <WalletConnectButton />
        </div>
      </div>
    </motion.header>
  )
}
