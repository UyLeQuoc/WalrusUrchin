import { PenLineIcon } from "lucide-react"

import { Button } from "@workspace/cores/components/button"
import { Logo } from "@/components/logo"
import { ModeToggle } from "@/components/mode-toggle"
import { WalletConnectButton } from "@/components/wallet/wallet-connect-button"
import type { SocialNavItem } from "@/types/social"

type SocialSidebarProps = {
  navItems: SocialNavItem[]
}

export function SocialSidebar({ navItems }: SocialSidebarProps) {
  return (
    <aside className="sticky top-0 hidden h-svh min-w-0 flex-col gap-4 px-3 py-4 md:flex lg:px-4">
      <div className="flex items-center justify-between gap-2 px-2">
        <Logo className="min-w-0" />
        <ModeToggle />
      </div>

      <nav className="flex min-w-0 flex-col gap-1" aria-label="Social">
        {navItems.map((item) => {
          const Icon = item.icon

          return (
            <Button
              key={item.id}
              aria-current={item.active ? "page" : undefined}
              className="justify-start lg:w-full"
              size="lg"
              variant={item.active ? "secondary" : "ghost"}
            >
              <Icon data-icon="inline-start" aria-hidden="true" />
              <span className="hidden truncate lg:inline">{item.label}</span>
            </Button>
          )
        })}
      </nav>

      <Button className="lg:w-full" size="lg">
        <PenLineIcon data-icon="inline-start" aria-hidden="true" />
        <span className="hidden lg:inline">Create post</span>
      </Button>

      <div className="mt-auto">
        <WalletConnectButton className="hidden lg:inline-flex lg:w-full" />
      </div>
    </aside>
  )
}
