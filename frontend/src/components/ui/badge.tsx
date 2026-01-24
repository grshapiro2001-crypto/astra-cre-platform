import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-emerald-600",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-emerald-100",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        success:
          "border-transparent bg-success text-success-foreground hover:bg-success/80",
        warning:
          "border-transparent bg-warning text-warning-foreground hover:bg-warning/80",
        outline: "text-foreground border-border",
        emerald:
          "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
        canopy:
          "border-canopy-200 bg-canopy-50 text-canopy-700 hover:bg-canopy-100",
        sunlight:
          "border-sunlight-200 bg-sunlight-50 text-sunlight-700 hover:bg-sunlight-100",
        bark:
          "border-bark-200 bg-bark-50 text-bark-700 hover:bg-bark-100",
        moss:
          "border-moss-200 bg-moss-50 text-moss-700 hover:bg-moss-100",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
