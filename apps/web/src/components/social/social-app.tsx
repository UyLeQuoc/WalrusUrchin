import { Logo } from "@/components/logo"
import { ModeToggle } from "@/components/mode-toggle"
import { WalletConnectButton } from "@/components/wallet/wallet-connect-button"
import { FeedColumn } from "@/components/social/feed-column"
import { MobileNav } from "@/components/social/mobile-nav"
import { RightRail } from "@/components/social/right-rail"
import { SocialSidebar } from "@/components/social/social-sidebar"
import type {
  CreatorMetric,
  SocialComposerAction,
  SocialFeedTab,
  SocialNavItem,
  SocialPost,
  SocialTrend,
  SocialUser,
  SuggestedCreator,
} from "@/types/social"

type SocialAppProps = {
  actions: SocialComposerAction[]
  metrics: CreatorMetric[]
  navItems: SocialNavItem[]
  posts: SocialPost[]
  suggestedCreators: SuggestedCreator[]
  tabs: SocialFeedTab[]
  trends: SocialTrend[]
  users: SocialUser[]
  viewer: SocialUser
}

export function SocialApp({
  actions,
  metrics,
  navItems,
  posts,
  suggestedCreators,
  tabs,
  trends,
  users,
  viewer,
}: SocialAppProps) {
  const usersById = new Map(users.map((user) => [user.id, user]))

  return (
    <div className="min-h-svh bg-background text-foreground selection:bg-primary selection:text-primary-foreground">
      <header className="sticky top-0 z-30 border-b border-border bg-background px-4 py-3 md:hidden">
        <div className="flex items-center justify-between gap-3">
          <Logo />
          <div className="flex items-center gap-2">
            <ModeToggle />
            <WalletConnectButton />
          </div>
        </div>
      </header>

      <div className="mx-auto grid min-h-svh max-w-7xl grid-cols-1 md:grid-cols-[5rem_minmax(0,1fr)] lg:grid-cols-[16rem_minmax(0,42rem)_minmax(18rem,20rem)] xl:grid-cols-[17rem_minmax(0,44rem)_22rem]">
        <SocialSidebar navItems={navItems} />
        <FeedColumn
          actions={actions}
          posts={posts}
          tabs={tabs}
          usersById={usersById}
          viewer={viewer}
        />
        <RightRail
          metrics={metrics}
          suggestedCreators={suggestedCreators}
          trends={trends}
          usersById={usersById}
        />
      </div>

      <MobileNav navItems={navItems} />
    </div>
  )
}
