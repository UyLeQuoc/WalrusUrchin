import * as React from "react"
import { ToggleGroup as ToggleGroupPrimitive } from "radix-ui"
import { type VariantProps } from "class-variance-authority"

import { buttonVariants } from "@workspace/cores/components/button"
import { cn } from "@workspace/cores/lib/utils"

function ToggleGroup({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Root> &
  VariantProps<typeof buttonVariants>) {
  return (
    <ToggleGroupPrimitive.Root
      data-slot="toggle-group"
      data-variant={variant}
      data-size={size}
      className={cn(
        "group/toggle-group flex w-fit items-center rounded-2xl bg-muted p-1",
        className
      )}
      {...props}
    />
  )
}

function ToggleGroupItem({
  className,
  children,
  variant = "ghost",
  size = "default",
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Item> &
  VariantProps<typeof buttonVariants>) {
  return (
    <ToggleGroupPrimitive.Item
      data-slot="toggle-group-item"
      data-variant={variant}
      data-size={size}
      className={cn(
        buttonVariants({ variant, size }),
        "min-w-0 flex-1 rounded-xl text-muted-foreground shadow-none data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-xs",
        className
      )}
      {...props}
    >
      {children}
    </ToggleGroupPrimitive.Item>
  )
}

export { ToggleGroup, ToggleGroupItem }
