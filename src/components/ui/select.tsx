import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>;

/** Select natif stylé (léger, accessible, sans dépendance externe). */
const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => (
    <div className="relative">
      <select
        ref={ref}
        className={cn(
          "h-10 w-full appearance-none rounded-lg border border-input bg-card pl-3 pr-9 text-sm shadow-xs transition-colors",
          "focus-visible:outline-none focus-visible:border-brand/60 focus-visible:ring-2 focus-visible:ring-brand/15",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        strokeWidth={1.75}
      />
    </div>
  ),
);
Select.displayName = "Select";

export { Select };
