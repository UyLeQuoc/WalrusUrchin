import {
  BookmarkIcon,
  FileIcon,
  HeartIcon,
  LockKeyholeIcon,
  MessageCircleIcon,
  MoreHorizontalIcon,
  Repeat2Icon,
  Share2Icon,
  type LucideIcon,
} from "lucide-react"

import { Badge } from "@workspace/cores/components/badge"
import { Button } from "@workspace/cores/components/button"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/cores/components/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/cores/components/dropdown-menu"
import { Separator } from "@workspace/cores/components/separator"
import { SocialAvatar } from "@/components/social/social-avatar"
import { formatAddress } from "@/lib/format-address"
import type { SocialPost, SocialVisibility, SocialUser } from "@/types/social"

type PostCardProps = {
  author: SocialUser
  post: SocialPost
}

const visibilityLabels: Record<SocialVisibility, string> = {
  public: "Public",
  followers: "Followers",
  subscribers: "Subscribers",
  "pay-per-view": "Pay to view",
  "paid-file": "Paid file",
}

function formatCount(value: number) {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`
  }

  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`
  }

  return value.toString()
}

export function PostCard({ author, post }: PostCardProps) {
  return (
    <Card
      className="rounded-none border-y border-border shadow-none ring-0 md:rounded-lg md:border"
      size="sm"
    >
      <CardHeader>
        <div className="flex min-w-0 items-start gap-3">
          <SocialAvatar
            address={author.address}
            aria-label={`${formatAddress(author.address)} avatar`}
          />
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              <CardTitle className="truncate" title={author.address}>
                {formatAddress(author.address)}
              </CardTitle>
              <span className="text-sm text-muted-foreground">·</span>
              <span className="text-sm text-muted-foreground">
                {post.createdAtLabel}
              </span>
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button aria-label="Post options" size="icon-sm" variant="ghost">
                <MoreHorizontalIcon aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuGroup>
                <DropdownMenuItem>Save post</DropdownMenuItem>
                <DropdownMenuItem>Copy link</DropdownMenuItem>
                <DropdownMenuItem>
                  Mute {formatAddress(author.address)}
                </DropdownMenuItem>
                <DropdownMenuItem variant="destructive">
                  Report
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {post.pinned ? <Badge variant="outline">Pinned</Badge> : null}
          <Badge
            variant={post.visibility === "public" ? "secondary" : "outline"}
          >
            <LockKeyholeIcon data-icon="inline-start" aria-hidden="true" />
            {visibilityLabels[post.visibility]}
          </Badge>
          {post.monetization ? (
            <Badge variant="default">{post.monetization.priceLabel}</Badge>
          ) : null}
        </div>

        <p className="text-base leading-7">{post.body}</p>

        {post.tags.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {post.tags.map((tag) => (
              <Badge key={tag} variant="ghost">
                #{tag}
              </Badge>
            ))}
          </div>
        ) : null}

        {post.media ? (
          <div className="aspect-[16/9] overflow-hidden rounded-lg bg-muted">
            <img
              alt={post.media.alt}
              className="size-full object-cover"
              loading="lazy"
              src={post.media.url}
            />
          </div>
        ) : null}

        {post.attachments && post.attachments.length > 0 ? (
          <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted p-3">
            {post.attachments.map((attachment) => (
              <div key={attachment.id} className="flex items-center gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-background text-muted-foreground">
                  <FileIcon aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {attachment.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {attachment.sizeLabel} · {attachment.kind}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {post.monetization ? (
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-secondary p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="font-medium">{post.monetization.accessLabel}</p>
              <p className="text-sm text-muted-foreground">
                {post.monetization.kind} · {post.monetization.priceLabel}
              </p>
            </div>
            <Button className="sm:w-fit">{post.monetization.ctaLabel}</Button>
          </div>
        ) : null}
      </CardContent>

      <CardFooter className="flex flex-col gap-3">
        <Separator />
        <div className="grid w-full grid-cols-5 gap-1">
          <PostAction
            icon={MessageCircleIcon}
            label="Replies"
            value={formatCount(post.stats.replies)}
          />
          <PostAction
            icon={Repeat2Icon}
            label="Reposts"
            value={formatCount(post.stats.reposts)}
          />
          <PostAction
            icon={HeartIcon}
            label="Reactions"
            value={formatCount(post.stats.reactions)}
          />
          <PostAction
            icon={BookmarkIcon}
            label="Bookmarks"
            value={formatCount(post.stats.bookmarks)}
          />
          <PostAction
            icon={Share2Icon}
            label="Views"
            value={post.stats.views}
          />
        </div>
      </CardFooter>
    </Card>
  )
}

type PostActionProps = {
  icon: LucideIcon
  label: string
  value: string
}

function PostAction({ icon: Icon, label, value }: PostActionProps) {
  return (
    <Button
      aria-label={`${label}: ${value}`}
      className="min-w-0 text-muted-foreground"
      size="sm"
      variant="ghost"
    >
      <Icon data-icon="inline-start" aria-hidden="true" />
      <span className="truncate">{value}</span>
    </Button>
  )
}
