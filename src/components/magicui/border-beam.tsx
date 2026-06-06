import { cn } from "@/lib/utils";

/**
 * Faisceau lumineux qui parcourt la bordure (façon Magic UI), en CSS pur via
 * offset-path. Overlay non bloquant : si l'effet n'est pas supporté, il reste
 * simplement invisible (aucun impact sur la mise en page).
 */
export function BorderBeam({
  className,
  size = 70,
  duration = 8,
  delay = 0,
  borderWidth = 1.5,
  colorFrom = "hsl(var(--brand))",
  colorTo = "hsl(var(--brand) / 0.2)",
}: {
  className?: string;
  size?: number;
  duration?: number;
  delay?: number;
  borderWidth?: number;
  colorFrom?: string;
  colorTo?: string;
}) {
  return (
    <div
      style={
        {
          "--size": size,
          "--duration": `${duration}s`,
          "--delay": `-${delay}s`,
          "--color-from": colorFrom,
          "--color-to": colorTo,
          "--border-width": borderWidth,
        } as React.CSSProperties
      }
      className={cn(
        "pointer-events-none absolute inset-0 rounded-[inherit]",
        "[border:calc(var(--border-width)*1px)_solid_transparent]",
        "![mask-clip:padding-box,border-box] ![mask-composite:intersect]",
        "[mask:linear-gradient(transparent,transparent),linear-gradient(white,white)]",
        "after:absolute after:aspect-square after:w-[calc(var(--size)*1px)]",
        "after:animate-border-beam after:[animation-delay:var(--delay)]",
        "after:[background:linear-gradient(to_left,var(--color-from),var(--color-to),transparent)]",
        "after:[offset-anchor:90%_50%]",
        "after:[offset-path:rect(0_auto_auto_0_round_calc(var(--size)*1px))]",
        className,
      )}
    />
  );
}
