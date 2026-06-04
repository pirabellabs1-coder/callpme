import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, type LucideIcon } from "lucide-react";

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  delta,
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon?: LucideIcon;
  delta?: { value: string; positive?: boolean };
  className?: string;
}) {
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-[0.8125rem] font-medium text-muted-foreground">
          {label}
        </p>
        {Icon && (
          <span className="inline-flex size-8 items-center justify-center rounded-lg bg-secondary text-foreground/55 ring-1 ring-inset ring-border [&_svg]:size-4">
            <Icon strokeWidth={1.75} />
          </span>
        )}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="tabular text-[1.75rem] font-semibold leading-none tracking-tight text-foreground">
          {value}
        </span>
        {delta && (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 text-xs font-medium",
              delta.positive ? "text-emerald-600" : "text-rose-600",
            )}
          >
            {delta.positive ? (
              <TrendingUp className="size-3.5" />
            ) : (
              <TrendingDown className="size-3.5" />
            )}
            {delta.value}
          </span>
        )}
      </div>
      {hint && <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
