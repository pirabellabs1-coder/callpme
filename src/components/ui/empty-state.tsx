import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/50 px-6 py-16 text-center",
        className,
      )}
    >
      <span className="inline-flex size-12 items-center justify-center rounded-xl bg-secondary text-foreground/45 ring-1 ring-inset ring-border [&_svg]:size-6">
        <Icon strokeWidth={1.5} />
      </span>
      <h3 className="mt-4 text-[0.95rem] font-semibold text-foreground">
        {title}
      </h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
