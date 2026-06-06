import { ComposerCard } from "@/components/social/composer-card"
import { PostCard } from "@/components/social/post-card"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@workspace/cores/components/toggle-group"
import type {
  SocialComposerAction,
  SocialFeedTab,
  SocialPost,
  SocialUser,
} from "@/types/social"

type FeedColumnProps = {
  actions: SocialComposerAction[]
  posts: SocialPost[]
  tabs: SocialFeedTab[]
  usersById: ReadonlyMap<string, SocialUser>
  viewer: SocialUser
}

export function FeedColumn({
  actions,
  posts,
  tabs,
  usersById,
  viewer,
}: FeedColumnProps) {
  return (
    <main className="min-w-0 border-border md:border-x">
      <header className="sticky top-0 z-20 border-b border-border bg-background px-4 py-3">
        <div className="flex flex-col gap-3">
          <div>
            <h1 className="text-xl leading-tight font-black">Home</h1>
            <p className="text-sm text-muted-foreground">
              Public posts, paid previews, private blogs, and file drops.
            </p>
          </div>
          <ToggleGroup
            aria-label="Feed filters"
            className="grid w-full grid-cols-3"
            defaultValue={tabs.find((tab) => tab.active)?.id ?? tabs[0]?.id}
            type="single"
          >
            {tabs.map((tab) => (
              <ToggleGroupItem
                key={tab.id}
                className="min-h-9 px-2"
                title={tab.description}
                value={tab.id}
              >
                {tab.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </header>

      <div className="flex flex-col gap-3 px-0 py-3 md:px-3">
        <ComposerCard actions={actions} viewer={viewer} />
        {posts.map((post) => {
          const author = usersById.get(post.authorId)

          if (!author) {
            return null
          }

          return <PostCard key={post.id} author={author} post={post} />
        })}
      </div>
    </main>
  )
}
