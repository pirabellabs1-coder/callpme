import Link from "next/link";
import { Inbox } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { leadCounts, listLeads } from "@/lib/db/appointments";
import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { LeadStatusSelect } from "@/components/leads/lead-status-select";
import { cn } from "@/lib/utils";

export const metadata = { title: "Prospects et messages" };
export const dynamic = "force-dynamic";

const KINDS = [
  { id: "", label: "Tout" },
  { id: "lead", label: "Prospects" },
  { id: "message", label: "Messages" },
  { id: "callback", label: "Rappels" },
  { id: "ticket", label: "Tickets" },
] as const;

const KIND_LABEL: Record<string, string> = { lead: "Prospect", message: "Message", callback: "Rappel", ticket: "Ticket" };

const dateLabel = (iso: string, tz: string) =>
  new Intl.DateTimeFormat("fr-FR", { timeZone: tz, day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(
    new Date(iso),
  );

function scoreVariant(score: number): "success" | "warning" | "muted" {
  return score >= 70 ? "success" : score >= 40 ? "warning" : "muted";
}

export default async function LeadsPage({ searchParams }: { searchParams: { kind?: string; test?: string } }) {
  const session = await requireSession();
  const kind = KINDS.some((k) => k.id === searchParams.kind) ? searchParams.kind ?? "" : "";
  const includeTest = searchParams.test === "1";
  const [rows, counts] = await Promise.all([
    listLeads(session.org.id, { kind: kind || undefined, includeTest }),
    leadCounts(session.org.id),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Prospects et messages"
        description="Tout ce que vos agents ont collecté : prospects qualifiés, messages laissés, rappels demandés et tickets."
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Type de fiche" className="flex flex-wrap gap-1 rounded-lg border border-border p-1">
          {KINDS.map((k) => {
            const pending = k.id ? counts[k.id] ?? 0 : 0;
            return (
              <Link
                key={k.id}
                href={`/leads${k.id ? `?kind=${k.id}` : ""}${includeTest ? `${k.id ? "&" : "?"}test=1` : ""}`}
                aria-current={kind === k.id ? "page" : undefined}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors",
                  kind === k.id ? "bg-secondary font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {k.label}
                {pending > 0 && (
                  <span className="rounded-full bg-brand/15 px-1.5 text-xs tabular-nums text-brand" aria-label={`${pending} à traiter`}>
                    {pending}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <Link
          href={`/leads?${new URLSearchParams({ ...(kind ? { kind } : {}), ...(includeTest ? {} : { test: "1" }) })}`}
          className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          {includeTest ? "Masquer les fiches de test" : "Afficher les fiches de test"}
        </Link>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title="Rien pour l'instant"
          description="Activez les outils « Enregistrer le contact », « Prendre un message » ou « Planifier un rappel » sur vos agents : les fiches arriveront ici."
        />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <caption className="sr-only">Fiches collectées par les agents</caption>
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th scope="col" className="px-4 py-3 font-medium">Contact</th>
                <th scope="col" className="px-4 py-3 font-medium">Type</th>
                <th scope="col" className="px-4 py-3 font-medium">Détails</th>
                <th scope="col" className="px-4 py-3 font-medium">Reçu</th>
                <th scope="col" className="px-4 py-3 font-medium">Suivi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((l) => (
                <tr key={l.id} className="align-top">
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">{l.name}</p>
                    <p className="text-muted-foreground">{[l.phone, l.email].filter(Boolean).join(" · ") || "—"}</p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant="muted">{KIND_LABEL[l.kind] ?? l.kind}</Badge>
                      {l.score != null && <Badge variant={scoreVariant(l.score)}>{l.score}/100</Badge>}
                      {l.interest && <Badge variant="outline">Intérêt {l.interest}</Badge>}
                      {l.isTest && <Badge variant="warning">Test</Badge>}
                      {l.crm.map((c) => (
                        <Badge key={c} variant="outline" className="capitalize">
                          {c}
                        </Badge>
                      ))}
                    </div>
                  </td>
                  <td className="max-w-md px-4 py-3 text-muted-foreground">
                    {l.callbackAt && (
                      <p className="font-medium text-foreground">Rappeler le {dateLabel(l.callbackAt, l.timezone)}</p>
                    )}
                    <p className="line-clamp-3 whitespace-pre-line">{l.notes || "—"}</p>
                    {(l.callSummary || l.callId) && (
                      <details className="group mt-2">
                        <summary className="cursor-pointer select-none text-sm font-medium text-brand-400 hover:underline">
                          Résumé de l&apos;appel
                        </summary>
                        <div className="mt-1.5 space-y-1.5 rounded-lg border border-border bg-secondary/30 p-3 text-foreground/90">
                          <p className="whitespace-pre-line">{l.callSummary || "Résumé indisponible pour cet appel."}</p>
                          {l.callId && (
                            <Link href={`/calls/${l.callId}`} className="inline-block text-sm font-medium text-brand-400 hover:underline">
                              Écouter l&apos;appel et lire la transcription →
                            </Link>
                          )}
                        </div>
                      </details>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                    {dateLabel(l.createdAt, l.timezone)}
                    {l.agentName && <span className="block text-xs">{l.agentName}</span>}
                  </td>
                  <td className="px-4 py-3">
                    <LeadStatusSelect id={l.id} status={l.status} name={l.name} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
