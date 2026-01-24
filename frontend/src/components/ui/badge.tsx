import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-emerald-500 text-white hover:bg-emerald-600",
        secondary:
          "border-transparent bg-emerald-100 text-emerald-800 hover:bg-emerald-200",
        destructive:
          "border-transparent bg-red-500 text-white hover:bg-red-600",
        success:
          "border-transparent bg-green-500 text-white hover:bg-green-600",
        warning:
          "border-transparent bg-amber-500 text-white hover:bg-amber-600",
        outline: "text-emerald-700 border-emerald-300",
        emerald:
          "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
        forest:
          "border-green-200 bg-green-50 text-green-700 hover:bg-green-100",
        amber:
          "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100",
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
