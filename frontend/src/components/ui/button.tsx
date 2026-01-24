import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-forest-sm hover:bg-emerald-600 active:bg-emerald-700",
        destructive:
          "bg-destructive text-destructive-foreground shadow-forest-sm hover:bg-destructive/90",
        outline:
          "border border-input bg-background hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-emerald-100",
        ghost: "hover:bg-emerald-50 hover:text-emerald-700",
        link: "text-primary underline-offset-4 hover:underline",
        success: "bg-success text-success-foreground shadow-forest-sm hover:bg-success/90",
        warning: "bg-warning text-warning-foreground shadow-forest-sm hover:bg-warning/90",
        forest: "bg-gradient-to-r from-emerald-600 to-canopy-600 text-white shadow-forest hover:from-emerald-700 hover:to-canopy-700 active:from-emerald-800 active:to-canopy-800",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3 text-xs",
        lg: "h-11 rounded-lg px-8 text-base",
        xl: "h-12 rounded-lg px-10 text-base font-semibold",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
