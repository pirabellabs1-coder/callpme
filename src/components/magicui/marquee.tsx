import { cn } from "@/lib/utils";

/**
 * Défilement horizontal infini (façon Magic UI). Le contenu est dupliqué pour
 * une boucle sans couture ; se met en pause au survol.
 */
export function Marquee({
  children,
  className,
  pauseOnHover = true,
  reverse = false,
  repeat = 2,
}: {
  children: React.ReactNode;
  className?: string;
  pauseOnHover?: boolean;
  reverse?: boolean;
  repeat?: number;
}) {
  return (
    <div
      className={cn(
        "group flex overflow-hidden p-2 [--gap:2.5rem] [gap:var(--gap)]",
        className,
      )}
    >
      {Array.from({ length: repeat }).map((_, i) => (
        <div
          key={i}
          className={cn(
            "flex shrink-0 items-center justify-around [gap:var(--gap)] animate-marquee",
            pauseOnHover && "group-hover:[animation-play-state:paused]",
            reverse && "[animation-direction:reverse]",
          )}
          aria-hidden={i > 0}
        >
          {children}
        </div>
      ))}
    </div>
  );
}
