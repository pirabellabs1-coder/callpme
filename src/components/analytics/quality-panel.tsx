import Link from "next/link";
import { Gauge } from "lucide-react";
import type { QualityOverview } from "@/lib/db/quality";
import { SLOW_RESPONSE_MS } from "@/lib/voice-engine/quality";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

const seconds = (ms: number | null) => (ms === null ? "—" : `${(ms / 1000).toFixed(1).replace(".", ",")} s`);
const when = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** Qualité technique : ce que les appelants ressentent (blancs, coupures, pannes). */
export function QualityPanel({ q }: { q: QualityOverview }) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2">
        <Gauge className="size-4 text-muted-foreground" aria-hidden />
        <h2 className="text-[0.95rem] font-semibold tracking-tight">Qualité technique</h2>
      </div>
      {q.measured === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">
          Mesurée automatiquement sur les prochains appels : temps de réponse de l&apos;agent, interruptions, pannes.
        </p>
      ) : (
        <>
          <dl className="mt-4 grid gap-4 sm:grid-cols-3">
            <div>
              <dt className="text-xs text-muted-foreground">Temps de réponse moyen</dt>
              <dd
                className={cn(
                  "mt-1 text-2xl font-semibold tabular",
                  q.responseAvgMs !== null && q.responseAvgMs > SLOW_RESPONSE_MS && "text-destructive",
                )}
              >
                {seconds(q.responseAvgMs)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Appels lents (&gt; {String(SLOW_RESPONSE_MS / 1000).replace(".", ",")} s)</dt>
              <dd className="mt-1 text-2xl font-semibold tabular">{q.slowRate ?? 0} %</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Appels avec un problème</dt>
              <dd className="mt-1 text-2xl font-semibold tabular">
                {q.withIssues} <span className="text-sm font-normal text-muted-foreground">sur {q.measured}</span>
              </dd>
            </div>
          </dl>
          {q.worst.length > 0 && (
            <div className="mt-5">
              <h3 className="text-xs font-medium text-muted-foreground">À revoir en priorité</h3>
              <ul className="mt-2 divide-y divide-border">
                {q.worst.map((w) => (
                  <li key={w.id}>
                    <Link
                      href={`/calls/${w.id}`}
                      className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 rounded-md py-2 text-sm hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/55"
                    >
                      <span className="font-medium">{w.agentName}</span>
                      <span className="text-xs text-muted-foreground">{when.format(w.createdAt)}</span>
                      <span className="min-w-0 flex-1 text-xs text-amber-600 dark:text-amber-400">{w.issue}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
