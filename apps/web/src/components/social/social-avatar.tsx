import { Avatar as Web3Avatar } from "web3-avatar-react"

import { cn } from "@workspace/cores/lib/utils"

type SocialAvatarProps = {
  address: string
  "aria-label"?: string
  className?: string
}

export function SocialAvatar({
  address,
  "aria-label": ariaLabel = "Wallet avatar",
  className,
}: SocialAvatarProps) {
  return (
    <Web3Avatar
      address={address}
      aria-label={ariaLabel}
      className={cn("size-10 shrink-0", className)}
    />
  )
}
