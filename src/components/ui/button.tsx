import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/55 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 active:translate-y-px [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // CTA sombre par défaut (esprit Linear/Stripe)
        default:
          "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90",
        // Conversion forte — orange de marque
        brand:
          "bg-brand text-brand-foreground shadow-sm hover:bg-brand-600 shadow-brand/0 hover:shadow-brand",
        secondary:
          "bg-secondary text-secondary-foreground border border-border/70 hover:bg-accent",
        outline:
          "border border-input bg-card text-foreground shadow-xs hover:bg-accent hover:text-accent-foreground",
        ghost: "text-foreground/80 hover:bg-accent hover:text-foreground",
        destructive:
          "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        link: "text-brand underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-8 px-3 text-[0.8125rem] rounded-md",
        default: "h-10 px-4 py-2",
        lg: "h-11 px-6 text-[0.9375rem]",
        icon: "h-10 w-10",
        "icon-sm": "h-8 w-8 rounded-md",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  ),
);
Button.displayName = "Button";

export { Button, buttonVariants };
