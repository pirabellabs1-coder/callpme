/**
 * Graphique d'aire en SVG pur — courbe « total » avec aire dégradée mono
 * (orange de marque) et courbe « résolus » superposée. Aucune dépendance.
 */

export interface AreaPoint {
  label: string;
  total: number;
  resolved: number;
}

export function AreaChart({ data }: { data: AreaPoint[] }) {
  const W = 720;
  const H = 220;
  const padX = 8;
  const padTop = 16;
  const padBottom = 28;
  const n = data.length;
  const max = Math.max(1, ...data.map((d) => d.total));

  if (n === 0) {
    return (
      <div className="flex h-[220px] w-full items-center justify-center text-sm text-muted-foreground">
        Aucune donnée sur la période.
      </div>
    );
  }

  const x = (i: number) =>
    padX + (n <= 1 ? 0 : (i / (n - 1)) * (W - padX * 2));
  const y = (v: number) =>
    padTop + (1 - v / max) * (H - padTop - padBottom);

  const linePath = (key: "total" | "resolved") =>
    data
      .map((d, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(d[key]).toFixed(1)}`)
      .join(" ");

  const areaPath =
    `${linePath("total")} L ${x(n - 1).toFixed(1)} ${H - padBottom} L ${x(0).toFixed(1)} ${H - padBottom} Z`;

  // Lignes de grille (4 niveaux)
  const gridY = [0, 0.25, 0.5, 0.75, 1].map((t) => padTop + t * (H - padTop - padBottom));

  // Étiquettes d'axe X espacées
  const labelEvery = Math.max(1, Math.ceil(n / 7));

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={H}
        preserveAspectRatio="none"
        role="img"
        aria-label="Volume d'appels sur la période"
      >
        <defs>
          <linearGradient id="area-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--brand))" stopOpacity="0.18" />
            <stop offset="100%" stopColor="hsl(var(--brand))" stopOpacity="0" />
          </linearGradient>
        </defs>

        {gridY.map((gy, i) => (
          <line
            key={i}
            x1={padX}
            x2={W - padX}
            y1={gy}
            y2={gy}
            stroke="hsl(var(--border))"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
        ))}

        <path d={areaPath} fill="url(#area-fill)" />
        <path
          d={linePath("total")}
          fill="none"
          stroke="hsl(var(--brand))"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d={linePath("resolved")}
          fill="none"
          stroke="hsl(var(--brand))"
          strokeOpacity="0.35"
          strokeWidth="1.5"
          strokeDasharray="3 3"
          vectorEffect="non-scaling-stroke"
        />

        {data.map((d, i) => (
          <circle
            key={i}
            cx={x(i)}
            cy={y(d.total)}
            r="2.5"
            fill="hsl(var(--card))"
            stroke="hsl(var(--brand))"
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
          />
        ))}

        {data.map((d, i) =>
          i % labelEvery === 0 ? (
            <text
              key={i}
              x={x(i)}
              y={H - 8}
              fontSize="11"
              textAnchor="middle"
              fill="hsl(var(--muted-foreground))"
            >
              {d.label}
            </text>
          ) : null,
        )}
      </svg>
    </div>
  );
}
