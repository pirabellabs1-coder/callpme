import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors [&_svg]:size-3",
  {
    variants: {
      variant: {
        default: "bg-secondary text-secondary-foreground",
        brand: "bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-600/20",
        outline: "border border-border text-foreground/70",
        success:
          "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/15",
        warning:
          "bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/15",
        danger: "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-600/15",
        muted: "bg-muted text-muted-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { badgeVariants };
