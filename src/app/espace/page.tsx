import Link from "next/link";
import { requireClientSession } from "@/lib/auth/session";
import { clientCalls, clientStats } from "@/lib/portal/data";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Tableau de bord" };
export const dynamic = "force-dynamic";

const STATUS: Record<string, string> = {
  completed: "Terminé",
  transferred: "Transféré",
  missed: "Manqué",
  failed: "Échec",
  in_progress: "En cours",
};

export default async function PortalHome() {
  const s = await requireClientSession();
  const since = new Date(Date.now() - 30 * 86_400_000);
  const [stats, calls] = await Promise.all([clientStats(s, since), clientCalls(s, 8)]);
  const fmt = new Intl.NumberFormat("fr-FR");
  const time = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" });
  const tiles = [
    { label: "Appels traités", value: fmt.format(stats.calls) },
    { label: "Minutes", value: fmt.format(stats.minutes) },
    { label: "Rendez-vous pris", value: fmt.format(stats.appointments) },
    { label: "Prospects et messages", value: fmt.format(stats.leads) },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Bonjour {s.user.name ?? ""}</h1>
        <p className="text-sm text-muted-foreground">
          Activité de vos {stats.agents} assistant{stats.agents > 1 ? "s" : ""} sur les 30 derniers jours.
        </p>
      </div>
      <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {tiles.map((t) => (
          <Card key={t.label} className="p-4">
            <dt className="text-xs text-muted-foreground">{t.label}</dt>
            <dd className="mt-1 tabular-nums text-2xl font-semibold">{t.value}</dd>
          </Card>
        ))}
      </dl>
      <section aria-labelledby="recent">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="recent" className="text-base font-semibold">
            Derniers appels
          </h2>
          <Link href="/espace/appels" className="text-sm font-medium text-brand hover:underline">
            Tous les appels
          </Link>
        </div>
        {calls.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun appel pour l&apos;instant.</p>
        ) : (
          <ul className="space-y-2">
            {calls.map((c) => (
              <li key={c.id}>
                <Link href={`/espace/appels/${c.id}`} className="block rounded-xl border border-border p-3 transition-colors hover:bg-accent">
                  <span className="flex flex-wrap items-center justify-between gap-2 text-sm">
                    <span className="font-medium">{c.outcome ?? "Appel"}</span>
                    <span className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="muted">{STATUS[c.status] ?? c.status}</Badge>
                      {time.format(c.createdAt)}
                    </span>
                  </span>
                  {c.summary && <span className="mt-1 line-clamp-2 block text-sm text-muted-foreground">{c.summary}</span>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
