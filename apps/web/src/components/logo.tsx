import * as React from "react"

import { cn } from "@workspace/cores/lib/utils"

export type LogoProps = React.ComponentPropsWithoutRef<"a"> & {
  textClassName?: string
}

export function Logo({
  className,
  href = "#top",
  textClassName,
  ...props
}: LogoProps) {
  return (
    <a
      className={cn("flex min-w-0 items-center gap-3", className)}
      href={href}
      aria-label="WalrusUrchin home"
      {...props}
    >
      <span
        className={cn(
          "truncate text-base font-black text-foreground",
          textClassName
        )}
      >
        WalrusUrchin
      </span>
    </a>
  )
}
