import {
  BellIcon,
  BookmarkIcon,
  CompassIcon,
  FileTextIcon,
  HomeIcon,
  ImagePlusIcon,
  LockKeyholeIcon,
  MailIcon,
  SearchIcon,
  UserRoundIcon,
  VideoIcon,
  WalletCardsIcon,
} from "lucide-react"

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

export const viewerProfile: SocialUser = {
  id: "viewer",
  address: "0x7f4e2a9c13d8b60fbc49e7a5210d3f94a60c2b18e5d947f0a8c6b331d4e2f901",
}

export const socialUsers: SocialUser[] = [
  viewerProfile,
  {
    id: "maya",
    address:
      "0x1c8bd34f92a05e7b6c118d49ae302fb76a65dc8894fe32b01577c6e41a9d0f2c",
  },
  {
    id: "nova",
    address:
      "0x5a0de718c9b246ef9130ab47d65c8e239f10a4bc7d88021e43f69a152cd7b306",
  },
  {
    id: "leo",
    address:
      "0x98bce04d6fa21358c77b0e1a39f42d86a5c3e0bf12d947c6a8b53e90f21d4a6c",
  },
  {
    id: "rhea",
    address:
      "0xf31c7e08b46a9d5027e61c83a4bf95d206ac718e3f0b249c65de1084a79bc532",
  },
]

export const socialNavItems: SocialNavItem[] = [
  { id: "home", label: "Home", icon: HomeIcon, active: true },
  { id: "discover", label: "Discover", icon: CompassIcon },
  { id: "search", label: "Search", icon: SearchIcon },
  { id: "notifications", label: "Notifications", icon: BellIcon },
  { id: "messages", label: "Messages", icon: MailIcon },
  { id: "bookmarks", label: "Bookmarks", icon: BookmarkIcon },
  { id: "memberships", label: "Memberships", icon: WalletCardsIcon },
  { id: "profile", label: "Profile", icon: UserRoundIcon },
]

export const composerActions: SocialComposerAction[] = [
  { id: "media", label: "Add media", icon: ImagePlusIcon },
  { id: "blog", label: "Long-form blog", icon: FileTextIcon },
  { id: "video", label: "Video", icon: VideoIcon },
  { id: "private", label: "Paid/private", icon: LockKeyholeIcon },
]

export const feedTabs: SocialFeedTab[] = [
  {
    id: "for-you",
    label: "For you",
    description: "Public posts and paid previews from the network",
    active: true,
  },
  {
    id: "following",
    label: "Following",
    description: "Creators and friends you follow",
  },
  {
    id: "paid",
    label: "Paid",
    description: "Subscriber posts, PPV drops, and files",
  },
]

export const socialPosts: SocialPost[] = [
  {
    id: "post-maya-research",
    authorId: "maya",
    visibility: "subscribers",
    createdAtLabel: "12m",
    body: "Cut a new private research note from tomorrow's essay. Public preview is open; members get the source list, script draft, and the full edit map.",
    tags: ["creator-notes", "private-blog"],
    media: {
      kind: "image",
      url: "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1200&q=80",
      alt: "A desk with notes, a laptop, and research material arranged for editing.",
    },
    attachments: [
      {
        id: "maya-script",
        name: "Essay script draft",
        kind: "document",
        sizeLabel: "42 KB",
      },
      {
        id: "maya-source-map",
        name: "Source map",
        kind: "document",
        sizeLabel: "118 KB",
      },
    ],
    monetization: {
      kind: "membership",
      priceLabel: "$9/mo",
      accessLabel: "Studio member",
      ctaLabel: "Subscribe to view",
    },
    stats: {
      replies: 38,
      reposts: 104,
      reactions: 1900,
      bookmarks: 428,
      views: "42K",
    },
    pinned: true,
  },
  {
    id: "post-nova-public",
    authorId: "nova",
    visibility: "public",
    createdAtLabel: "34m",
    body: "Public drop: a new feed layout pattern for social creator apps. The private file pack adds source tokens, component notes, and mobile states.",
    tags: ["design-systems", "social-ui"],
    media: {
      kind: "image",
      url: "https://images.unsplash.com/photo-1559028012-481c04fa702d?auto=format&fit=crop&w=1200&q=80",
      alt: "Design boards and interface sketches on a bright desk.",
    },
    monetization: {
      kind: "paid-file",
      priceLabel: "$12",
      accessLabel: "Figma + token files",
      ctaLabel: "Buy file pack",
    },
    stats: {
      replies: 91,
      reposts: 520,
      reactions: 7200,
      bookmarks: 1300,
      views: "118K",
    },
  },
  {
    id: "post-rhea-ppv",
    authorId: "rhea",
    visibility: "pay-per-view",
    createdAtLabel: "1h",
    body: "Published a paid brief on how social graphs, file entitlements, and token-gated posts should be indexed without leaking private metadata.",
    tags: ["privacy", "indexing", "walrus"],
    attachments: [
      {
        id: "rhea-brief",
        name: "Private metadata checklist",
        kind: "document",
        sizeLabel: "86 KB",
      },
    ],
    monetization: {
      kind: "pay-per-view",
      priceLabel: "$5",
      accessLabel: "One-time unlock",
      ctaLabel: "Unlock brief",
    },
    stats: {
      replies: 18,
      reposts: 76,
      reactions: 812,
      bookmarks: 204,
      views: "16K",
    },
  },
  {
    id: "post-leo-public",
    authorId: "leo",
    visibility: "public",
    createdAtLabel: "2h",
    body: "The best creator products do not split discovery, subscriptions, files, and comments across four tabs in four apps. Put the public and private journey in one timeline.",
    tags: ["product", "creator-economy"],
    stats: {
      replies: 44,
      reposts: 210,
      reactions: 3100,
      bookmarks: 566,
      views: "61K",
    },
  },
]

export const socialTrends: SocialTrend[] = [
  {
    id: "paid-files",
    label: "Paid file drops",
    summary: "Creators are bundling source files with social previews",
    volumeLabel: "18.2K posts",
  },
  {
    id: "private-blogs",
    label: "Private blogs",
    summary: "Long-form member posts are outperforming gated feeds",
    volumeLabel: "9.7K posts",
  },
  {
    id: "sui-social",
    label: "Sui social graph",
    summary: "Portable access objects and creator identity",
    volumeLabel: "4.4K posts",
  },
]

export const suggestedCreators: SuggestedCreator[] = [
  {
    id: "suggest-maya",
    userId: "maya",
    reason: "Popular with video essay fans",
    accessLabel: "$9/mo",
  },
  {
    id: "suggest-nova",
    userId: "nova",
    reason: "Source files and design systems",
    accessLabel: "$12 files",
  },
  {
    id: "suggest-rhea",
    userId: "rhea",
    reason: "Private research briefs",
    accessLabel: "$5 PPV",
  },
]

export const creatorMetrics: CreatorMetric[] = [
  {
    id: "followers",
    label: "Followers",
    value: "142K",
    detail: "+12.8K this month",
  },
  {
    id: "subscribers",
    label: "Paid subscribers",
    value: "8.6K",
    detail: "63% monthly renewal",
  },
  {
    id: "revenue",
    label: "Creator GMV",
    value: "$34.4K",
    detail: "Subscriptions, PPV, files",
  },
]
