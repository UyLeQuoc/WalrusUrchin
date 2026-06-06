import { Button } from "@workspace/cores/components/button"
import type { SocialNavItem } from "@/types/social"

type MobileNavProps = {
  navItems: SocialNavItem[]
}

export function MobileNav({ navItems }: MobileNavProps) {
  return (
    <nav
      aria-label="Mobile social"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background px-2 py-2 md:hidden"
    >
      <div className="mx-auto grid max-w-md grid-cols-5 gap-1">
        {navItems.slice(0, 5).map((item) => {
          const Icon = item.icon

          return (
            <Button
              key={item.id}
              aria-label={item.label}
              aria-current={item.active ? "page" : undefined}
              size="icon-lg"
              variant={item.active ? "secondary" : "ghost"}
            >
              <Icon aria-hidden="true" />
            </Button>
          )
        })}
      </div>
    </nav>
  )
}
