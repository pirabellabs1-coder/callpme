import { formatNumber } from "@/lib/utils";

export interface DonutSegment {
  label: string;
  value: number;
  /** Couleur CSS de l'arc (ex : "hsl(142 46% 38%)"). */
  color: string;
}

export function Donut({
  segments,
  centerLabel,
}: {
  segments: DonutSegment[];
  centerLabel: string;
}) {
  const size = 168;
  const stroke = 20;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const sum = segments.reduce((a, s) => a + s.value, 0) || 1;
  let offset = 0;

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:gap-7">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="shrink-0"
        role="img"
        aria-label="Répartition des issues d'appel"
      >
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="hsl(var(--secondary))"
            strokeWidth={stroke}
          />
          {segments.map((s, i) => {
            const len = (s.value / sum) * c;
            const el = (
              <circle
                key={i}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth={stroke}
                strokeDasharray={`${len} ${c - len}`}
                strokeDashoffset={-offset}
              />
            );
            offset += len;
            return el;
          })}
        </g>
        <text
          x={size / 2}
          y={size / 2 - 4}
          textAnchor="middle"
          className="fill-foreground"
          fontSize="26"
          fontWeight="600"
        >
          {formatNumber(sum)}
        </text>
        <text
          x={size / 2}
          y={size / 2 + 16}
          textAnchor="middle"
          className="fill-muted-foreground"
          fontSize="12"
        >
          {centerLabel}
        </text>
      </svg>

      <div className="w-full space-y-2.5">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center gap-2.5 text-sm">
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ background: s.color }}
            />
            <span className="flex-1 text-foreground">{s.label}</span>
            <span className="tabular text-muted-foreground">
              {formatNumber(s.value)}
            </span>
            <span className="w-10 text-right tabular text-muted-foreground/70">
              {Math.round((s.value / sum) * 100)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
