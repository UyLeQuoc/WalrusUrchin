import type { LucideIcon } from "lucide-react"

export type SocialVisibility =
  | "public"
  | "followers"
  | "subscribers"
  | "pay-per-view"
  | "paid-file"

export type SocialMediaKind = "image" | "video" | "audio" | "document"

export type MonetizationKind =
  | "membership"
  | "pay-per-view"
  | "paid-file"
  | "tip"

export type SocialUser = {
  id: string
  address: string
}

export type SocialMedia = {
  kind: SocialMediaKind
  url: string
  alt: string
}

export type SocialAttachment = {
  id: string
  name: string
  kind: SocialMediaKind
  sizeLabel: string
}

export type SocialMonetization = {
  kind: MonetizationKind
  priceLabel: string
  accessLabel: string
  ctaLabel: string
}

export type SocialPostStats = {
  replies: number
  reposts: number
  reactions: number
  bookmarks: number
  views: string
}

export type SocialPost = {
  id: string
  authorId: string
  visibility: SocialVisibility
  createdAtLabel: string
  body: string
  tags: string[]
  media?: SocialMedia
  attachments?: SocialAttachment[]
  monetization?: SocialMonetization
  stats: SocialPostStats
  pinned?: boolean
}

export type SocialNavItem = {
  id: string
  label: string
  icon: LucideIcon
  active?: boolean
}

export type SocialComposerAction = {
  id: string
  label: string
  icon: LucideIcon
}

export type SocialFeedTab = {
  id: string
  label: string
  description: string
  active?: boolean
}

export type SocialTrend = {
  id: string
  label: string
  summary: string
  volumeLabel: string
}

export type SuggestedCreator = {
  id: string
  userId: string
  reason: string
  accessLabel: string
}

export type CreatorMetric = {
  id: string
  label: string
  value: string
  detail: string
}
