import { cn } from "@/lib/utils";

/**
 * Texte avec un reflet lumineux qui balaie (façon Magic UI), en CSS pur.
 * Deux couches : le texte de base reste TOUJOURS visible, un reflet clair passe
 * par-dessus (clippé au texte). Discret, dans les tons neutres.
 */
export function AnimatedShinyText({
  children,
  className,
  shimmerWidth = 80,
}: {
  children: React.ReactNode;
  className?: string;
  shimmerWidth?: number;
}) {
  return (
    <span className={cn("relative inline-block", className)}>
      {children}
      <span
        aria-hidden
        style={{ "--shiny-width": `${shimmerWidth}px` } as React.CSSProperties}
        className={cn(
          "pointer-events-none absolute inset-0 select-none bg-clip-text text-transparent",
          "animate-shiny-text [background-repeat:no-repeat] [background-size:var(--shiny-width)_100%]",
          "bg-gradient-to-r from-transparent via-white/90 to-transparent",
        )}
      >
        {children}
      </span>
    </span>
  );
}
