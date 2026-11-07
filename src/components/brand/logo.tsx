import { cn } from "@/lib/utils";

/**
 * Icône d'application : tuile orange, « C » blanc ouvert sur une onde vocale.
 * Pour les petits emplacements isolés (aperçus, avatars, favicon).
 */
export function LogoMark({
  className,
  size = 28,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      className={cn("shrink-0", className)}
      aria-hidden
    >
      <rect width="64" height="64" rx="18" fill="hsl(var(--brand))" />
      <path
        d="M42 21 A15 15 0 1 0 42 43"
        stroke="#fff"
        strokeWidth="7"
        strokeLinecap="round"
      />
      <g fill="#fff">
        <rect x="29" y="27" width="4.5" height="10" rx="2.25" />
        <rect x="37" y="23" width="4.5" height="18" rx="2.25" />
        <rect x="45" y="28" width="4.5" height="8" rx="2.25" />
      </g>
    </svg>
  );
}

/** Symbole seul : « C » orange + onde vocale (couleur du texte courant). */
export function LogoSymbol({
  className,
  size = 28,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      className={cn("shrink-0", className)}
      aria-hidden
    >
      <path
        d="M46.1 17.9 A20 20 0 1 0 46.1 46.1"
        stroke="hsl(var(--brand))"
        strokeWidth="9"
        strokeLinecap="round"
      />
      <g fill="currentColor">
        <rect x="27" y="26" width="5" height="12" rx="2.5" />
        <rect x="36" y="21" width="5" height="22" rx="2.5" />
        <rect x="45" y="27" width="5" height="10" rx="2.5" />
      </g>
    </svg>
  );
}

/** Logo complet : symbole + nom en minuscules. */
export function Logo({
  className,
  markSize = 28,
  showWordmark = true,
}: {
  className?: string;
  markSize?: number;
  showWordmark?: boolean;
}) {
  return (
    <span
      className={cn("inline-flex items-center gap-2 text-foreground", className)}
      aria-label="Callpme"
      role="img"
    >
      <LogoSymbol size={markSize} />
      {showWordmark && (
        <span className="text-[1.2rem] font-semibold leading-none tracking-[-0.045em]" aria-hidden>
          callpme
        </span>
      )}
    </span>
  );
}
