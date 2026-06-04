import { cn } from "@/lib/utils";

export interface BarItem {
  label: string;
  value: number;
  /** Texte secondaire (ex : « 92% résolus »). */
  secondary?: string;
  /** Classe Tailwind du point de couleur (catégorie). */
  dotClass?: string;
}

export function BarList({
  items,
  formatValue,
}: {
  items: BarItem[];
  formatValue?: (v: number) => string;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="space-y-3.5">
      {items.map((it) => (
        <div key={it.label}>
          <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
            <span className="inline-flex min-w-0 items-center gap-2 text-foreground">
              {it.dotClass && (
                <span className={cn("size-2 shrink-0 rounded-full", it.dotClass)} />
              )}
              <span className="truncate">{it.label}</span>
            </span>
            <span className="shrink-0 tabular text-muted-foreground">
              {formatValue ? formatValue(it.value) : it.value}
              {it.secondary ? (
                <span className="text-muted-foreground/70"> · {it.secondary}</span>
              ) : null}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-foreground/85"
              style={{ width: `${(it.value / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
