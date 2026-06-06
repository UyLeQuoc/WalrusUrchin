import { SocialApp } from "@/components/social/social-app"
import {
  composerActions,
  creatorMetrics,
  feedTabs,
  socialNavItems,
  socialPosts,
  socialTrends,
  socialUsers,
  suggestedCreators,
  viewerProfile,
} from "@/data/social-feed"

export function HomePage() {
  return (
    <SocialApp
      actions={composerActions}
      metrics={creatorMetrics}
      navItems={socialNavItems}
      posts={socialPosts}
      suggestedCreators={suggestedCreators}
      tabs={feedTabs}
      trends={socialTrends}
      users={socialUsers}
      viewer={viewerProfile}
    />
  )
}
