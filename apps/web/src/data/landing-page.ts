export type NavItem = {
  label: string
  href: string
}

export type HeroMetric = {
  value: string
  label: string
}

export type FeatureIcon = "identity" | "storage" | "payout" | "onboarding"

export type FeatureCard = {
  icon: FeatureIcon
  title: string
  description: string
}

export type WorkflowStep = {
  step: string
  title: string
  description: string
}

export type StackItem = {
  name: string
  role: string
  detail: string
}

export const navItems = [
  { label: "Creators", href: "#creators" },
  { label: "Workflow", href: "#workflow" },
  { label: "Stack", href: "#stack" },
  { label: "Join", href: "#join" },
] as const satisfies readonly NavItem[]

export const heroMetrics = [
  { value: "95%+", label: "target creator take-home" },
  { value: "0 SUI", label: "needed by fans to start" },
  { value: "24/7", label: "portable access checks" },
] as const satisfies readonly HeroMetric[]

export const trustMetrics = [
  { value: "Sui", label: "Move contracts own monetization" },
  { value: "Seal", label: "encrypted paid content by default" },
  { value: "Walrus", label: "durable creator-owned media" },
  { value: "Enoki", label: "passwordless, sponsored onboarding" },
] as const satisfies readonly HeroMetric[]

export const featureCards = [
  {
    icon: "identity",
    title: "Creator-owned identity",
    description:
      "Profiles resolve through SuiNS handles, so audiences and creator names stay portable beyond the app.",
  },
  {
    icon: "storage",
    title: "Encrypted content delivery",
    description:
      "Private posts, videos, and downloads are Seal-encrypted before Harbor stores the ciphertext on Walrus.",
  },
  {
    icon: "payout",
    title: "Transparent payouts",
    description:
      "Subscriptions, tips, pay-per-view, collaborator splits, and platform fees settle through auditable Move flows.",
  },
  {
    icon: "onboarding",
    title: "Fan access without wallet pain",
    description:
      "zkLogin, passkeys, and sponsored gas let fans unlock content without seed phrases or holding SUI first.",
  },
] as const satisfies readonly FeatureCard[]

export const workflowSteps = [
  {
    step: "01",
    title: "Claim the creator layer",
    description:
      "Register a creator profile, connect a SuiNS handle, and publish tiers as on-chain access rules.",
  },
  {
    step: "02",
    title: "Encrypt and publish",
    description:
      "Upload public previews and encrypted paid content through Harbor, backed by Walrus and Seal.",
  },
  {
    step: "03",
    title: "Fans subscribe gaslessly",
    description:
      "Fans sign in with familiar identity, pay the creator, and receive a portable subscription object.",
  },
  {
    step: "04",
    title: "Access works anywhere",
    description:
      "The same on-chain entitlement can unlock content in WalrusUrchin or any third-party Sui app.",
  },
] as const satisfies readonly WorkflowStep[]

export const stackItems = [
  {
    name: "Sui Move",
    role: "Monetization",
    detail:
      "Subscription NFTs, PPV entitlements, renewals, tips, and revenue splits.",
  },
  {
    name: "Walrus + Harbor",
    role: "Storage",
    detail:
      "Managed blob storage for encrypted media, previews, and durable creator assets.",
  },
  {
    name: "Seal",
    role: "Access",
    detail:
      "Key release is bound to on-chain tier, ownership, and expiration checks.",
  },
  {
    name: "Enoki",
    role: "Onboarding",
    detail:
      "zkLogin and sponsored gas keep the first fan action familiar and fast.",
  },
  {
    name: "memwal",
    role: "Memory",
    detail:
      "Creator concierge and fan support memory stay isolated behind the API boundary.",
  },
] as const satisfies readonly StackItem[]
