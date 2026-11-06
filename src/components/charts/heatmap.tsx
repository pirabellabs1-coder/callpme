/**
 * Heatmap jour × heure rendue comme un vrai <table> : lisible par les
 * lecteurs d'écran (en-têtes de lignes/colonnes, valeur de chaque cellule),
 * intensité via l'opacité de la couleur de marque (variable CSS du thème).
 */
import { cn } from "@/lib/utils";

const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

export function Heatmap({
  data,
  caption,
  minHours = [8, 20],
}: {
  /** data[jour 0=lundi][heure 0..23] */
  data: number[][];
  caption: string;
  /** Plage horaire affichée au minimum (élargie si des appels tombent en dehors). */
  minHours?: [number, number];
}) {
  let first = minHours[0];
  let last = minHours[1];
  data.forEach((row) =>
    row.forEach((v, h) => {
      if (v > 0) {
        first = Math.min(first, h);
        last = Math.max(last, h);
      }
    }),
  );
  const hours = Array.from({ length: last - first + 1 }, (_, i) => first + i);
  const max = Math.max(1, ...data.flat());

  let peak = { day: 0, hour: 0, value: 0 };
  data.forEach((row, d) =>
    row.forEach((v, h) => {
      if (v > peak.value) peak = { day: d, hour: h, value: v };
    }),
  );

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[34rem] border-separate border-spacing-[3px] text-[0.65rem]">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              <th scope="col" className="w-10">
                <span className="sr-only">Jour</span>
              </th>
              {hours.map((h) => (
                <th
                  key={h}
                  scope="col"
                  className="pb-1 text-center font-normal tabular text-muted-foreground"
                >
                  <span aria-hidden="true">{h % 2 === 0 ? `${h}h` : ""}</span>
                  <span className="sr-only">{`${h}h–${h + 1}h`}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, d) => (
              <tr key={d}>
                <th
                  scope="row"
                  className="pr-1 text-left font-medium text-muted-foreground"
                >
                  <abbr title={DAYS[d]} className="no-underline">
                    {DAYS[d].slice(0, 3)}
                  </abbr>
                </th>
                {hours.map((h) => {
                  const v = row[h] ?? 0;
                  const intensity = v / max;
                  return (
                    <td
                      key={h}
                      title={`${DAYS[d]} ${h}h : ${v} appel${v > 1 ? "s" : ""}`}
                      className={cn(
                        "h-6 rounded-[4px]",
                        v === 0 && "bg-secondary/70",
                      )}
                      style={
                        v > 0
                          ? { backgroundColor: `hsl(var(--brand) / ${(0.15 + intensity * 0.85).toFixed(2)})` }
                          : undefined
                      }
                    >
                      <span className="sr-only">{v}</span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
        <p>
          {peak.value > 0
            ? `Pic : ${DAYS[peak.day].toLowerCase()} entre ${peak.hour}h et ${peak.hour + 1}h (${peak.value} appel${peak.value > 1 ? "s" : ""}).`
            : "Aucun appel sur la période."}
        </p>
        <div className="flex items-center gap-1.5" aria-hidden="true">
          <span>Moins</span>
          {[0.15, 0.4, 0.65, 1].map((o) => (
            <span
              key={o}
              className="size-3 rounded-[3px]"
              style={{ backgroundColor: `hsl(var(--brand) / ${o})` }}
            />
          ))}
          <span>Plus</span>
        </div>
      </div>
    </div>
  );
}
