import Link from "next/link";
import type { AgentOutcome } from "@/lib/db/outcomes";
import { Card } from "@/components/ui/card";
import { formatNumber } from "@/lib/utils";

const pct = (n: number, d: number) => (d > 0 ? `${Math.round((n / d) * 100)} %` : "—");

/** Tableau des résultats par agent : ce que chaque agent a réellement produit. */
export function AgentOutcomesTable({ rows, caption }: { rows: AgentOutcome[]; caption: string }) {
  const active = rows.filter((r) => r.calls > 0 || r.appointments > 0 || r.leads > 0);
  return (
    <Card className="overflow-x-auto">
      <div className="p-5 pb-3">
        <h2 className="text-[0.95rem] font-semibold tracking-tight">Résultats par agent</h2>
        <p className="text-sm text-muted-foreground">{caption}</p>
      </div>
      {active.length === 0 ? (
        <p className="px-5 pb-5 text-sm text-muted-foreground">Aucune activité sur la période.</p>
      ) : (
        <table className="w-full min-w-[720px] text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-y border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th scope="col" className="px-5 py-2.5 font-medium">Agent</th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">Appels</th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">Minutes</th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">Résolus</th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">Transférés</th>
              <th scope="col" className="px-3 py-2.5 text-right font-medium">Rendez-vous</th>
              <th scope="col" className="px-5 py-2.5 text-right font-medium">Prospects</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border tabular-nums">
            {active.map((r) => (
              <tr key={r.agentId} className="hover:bg-foreground/[0.02]">
                <th scope="row" className="px-5 py-3 text-left font-medium">
                  <Link href={`/agents/${r.agentId}`} className="hover:text-brand">
                    {r.agentName}
                  </Link>
                </th>
                <td className="px-3 py-3 text-right">{formatNumber(r.calls)}</td>
                <td className="px-3 py-3 text-right text-muted-foreground">{formatNumber(r.minutes)}</td>
                <td className="px-3 py-3 text-right">{pct(r.resolved, r.calls)}</td>
                <td className="px-3 py-3 text-right text-muted-foreground">{pct(r.transferred, r.calls)}</td>
                <td className="px-3 py-3 text-right font-medium text-foreground">{r.appointments || "—"}</td>
                <td className="px-5 py-3 text-right font-medium text-foreground">{r.leads || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}
