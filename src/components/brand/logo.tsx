import { cn } from "@/lib/utils";

/** Marque seule : tuile orange + onde vocale (équaliseur). */
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
      viewBox="0 0 32 32"
      fill="none"
      className={cn("shrink-0", className)}
      aria-hidden
    >
      <rect width="32" height="32" rx="9" fill="hsl(var(--brand))" />
      <rect width="32" height="32" rx="9" fill="url(#cpm-sheen)" />
      {/* Onde vocale — 5 barres symétriques */}
      <g fill="#fff">
        <rect x="4.5" y="12" width="3" height="8" rx="1.5" opacity="0.78" />
        <rect x="9.5" y="9" width="3" height="14" rx="1.5" opacity="0.9" />
        <rect x="14.5" y="6" width="3" height="20" rx="1.5" />
        <rect x="19.5" y="9" width="3" height="14" rx="1.5" opacity="0.9" />
        <rect x="24.5" y="12" width="3" height="8" rx="1.5" opacity="0.78" />
      </g>
      <defs>
        <linearGradient id="cpm-sheen" x1="0" y1="0" x2="0" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fff" stopOpacity="0.16" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/** Logo complet : marque + wordmark. */
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
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark size={markSize} />
      {showWordmark && (
        <span className="text-[1.15rem] font-semibold tracking-[-0.03em] text-foreground">
          Callpme
        </span>
      )}
    </span>
  );
}
