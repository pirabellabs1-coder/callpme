/**
 * Graphique d'aire en SVG pur — courbe « total » avec aire dégradée mono
 * (orange de marque) et courbe « résolus » superposée. Aucune dépendance.
 *
 * Le SVG est étiré horizontalement (preserveAspectRatio="none") : les
 * libellés d'axe sont donc rendus en HTML (pas de texte déformé) et les
 * points via des traits à bouts ronds non mis à l'échelle (restent ronds).
 * Couleurs : uniquement des variables CSS du thème.
 */
import { formatNumber } from "@/lib/utils";

export interface AreaPoint {
  label: string;
  total: number;
  resolved: number;
}

export function AreaChart({
  data,
  ariaLabel = "Volume d'appels sur la période",
  seriesLabels,
}: {
  data: AreaPoint[];
  ariaLabel?: string;
  /**
   * Libellés des séries. Si fournis, un tableau de données équivalent est
   * exposé aux lecteurs d'écran (alternative textuelle au graphique).
   */
  seriesLabels?: { total: string; resolved?: string };
}) {
  const W = 720;
  const H = 220;
  const padX = 8;
  const padTop = 12;
  const padBottom = 8;
  const n = data.length;
  const max = Math.max(1, ...data.map((d) => d.total));

  if (n === 0) {
    return (
      <div className="flex h-[220px] w-full items-center justify-center text-sm text-muted-foreground">
        Aucune donnée sur la période.
      </div>
    );
  }

  const x = (i: number) => padX + (n <= 1 ? (W - padX * 2) / 2 : (i / (n - 1)) * (W - padX * 2));
  const y = (v: number) => padTop + (1 - v / max) * (H - padTop - padBottom);
  const xPct = (i: number) => (x(i) / W) * 100;

  const linePath = (key: "total" | "resolved") =>
    data
      .map((d, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(d[key]).toFixed(1)}`)
      .join(" ");

  const areaPath = `${linePath("total")} L ${x(n - 1).toFixed(1)} ${H - padBottom} L ${x(0).toFixed(1)} ${H - padBottom} Z`;

  // Lignes de grille (4 niveaux)
  const gridT = [0, 0.25, 0.5, 0.75, 1];
  const gridY = gridT.map((t) => padTop + t * (H - padTop - padBottom));

  // Étiquettes d'axe X espacées
  const labelEvery = Math.max(1, Math.ceil(n / 7));
  const showDots = n <= 31;
  // Série « résolus » masquée quand elle duplique le total (usages mono-série).
  const showResolved = data.some((d) => d.resolved !== d.total);

  return (
    <figure className="w-full">
      <div className="relative">
        {/* Échelle Y (HTML, non déformée) */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-1 top-0 -translate-y-1/2 rounded bg-card/80 px-1 text-[0.65rem] tabular text-muted-foreground"
          style={{ top: `${(gridY[0] / H) * 100}%` }}
        >
          {formatNumber(max)}
        </span>
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-1 -translate-y-1/2 rounded bg-card/80 px-1 text-[0.65rem] tabular text-muted-foreground"
          style={{ top: `${(gridY[2] / H) * 100}%` }}
        >
          {formatNumber(Math.round(max / 2))}
        </span>

        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          height={H}
          preserveAspectRatio="none"
          role="img"
          aria-label={ariaLabel}
          className="block"
        >
          <defs>
            <linearGradient id="area-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--brand))" stopOpacity="0.22" />
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
          {showResolved && (
          <path
            d={linePath("resolved")}
            fill="none"
            stroke="hsl(var(--success))"
            strokeOpacity="0.8"
            strokeWidth="1.5"
            strokeDasharray="4 3"
            vectorEffect="non-scaling-stroke"
          />
          )}
          <path
            d={linePath("total")}
            fill="none"
            stroke="hsl(var(--brand))"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />

          {showDots &&
            data.map((d, i) => {
              const dot = `M ${x(i).toFixed(1)} ${y(d.total).toFixed(1)} l 0.001 0`;
              return (
                <g key={i}>
                  <path
                    d={dot}
                    stroke="hsl(var(--brand))"
                    strokeWidth="7"
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                  />
                  <path
                    d={dot}
                    stroke="hsl(var(--card))"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                  />
                </g>
              );
            })}
        </svg>
      </div>

      {/* Axe X (HTML) */}
      <div aria-hidden="true" className="relative mt-2 h-4">
        {data.map((d, i) =>
          i % labelEvery === 0 || i === n - 1 ? (
            <span
              key={i}
              className="absolute top-0 -translate-x-1/2 whitespace-nowrap text-[0.7rem] text-muted-foreground first:translate-x-0 last:-translate-x-full"
              style={{ left: `${xPct(i)}%` }}
            >
              {i === n - 1 || n - 1 - i >= labelEvery / 2 ? d.label : ""}
            </span>
          ) : null,
        )}
      </div>

      {seriesLabels && (
        <table className="sr-only">
          <caption>{ariaLabel}</caption>
          <thead>
            <tr>
              <th scope="col">Jour</th>
              <th scope="col">{seriesLabels.total}</th>
              {seriesLabels.resolved && <th scope="col">{seriesLabels.resolved}</th>}
            </tr>
          </thead>
          <tbody>
            {data.map((d, i) => (
              <tr key={i}>
                <th scope="row">{d.label}</th>
                <td>{d.total}</td>
                {seriesLabels.resolved && <td>{d.resolved}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </figure>
  );
}
