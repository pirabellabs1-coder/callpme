import { cn, initials } from "@/lib/utils";

export function Avatar({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex size-9 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-foreground/70 ring-1 ring-inset ring-border",
        className,
      )}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}
