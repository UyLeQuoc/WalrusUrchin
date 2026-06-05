import * as React from "react"
import { ShieldCheckIcon } from "lucide-react"

import { cn } from "@workspace/cores/lib/utils"

export type LogoProps = React.ComponentPropsWithoutRef<"a"> & {
  highlightClassName?: string
  markClassName?: string
  showMark?: boolean
  showText?: boolean
  textClassName?: string
}

export function Logo({
  className,
  highlightClassName,
  href = "#top",
  markClassName,
  showMark = true,
  showText = true,
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
      {showMark ? (
        <span
          className={cn(
            "grid size-9 shrink-0 place-items-center rounded-[8px] bg-primary text-primary-foreground",
            markClassName
          )}
        >
          <ShieldCheckIcon aria-hidden="true" />
        </span>
      ) : null}

      {showText ? (
        <span
          className={cn(
            "truncate text-base font-black text-foreground",
            textClassName
          )}
        >
          Walrus
          <span
            className={cn(
              "ml-0.5 rounded-[4px] bg-primary px-1.5 py-0.5 text-primary-foreground",
              highlightClassName
            )}
          >
            Urchin
          </span>
        </span>
      ) : null}
    </a>
  )
}
