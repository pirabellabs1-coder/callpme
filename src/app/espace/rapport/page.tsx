import { requireClientSession } from "@/lib/auth/session";
import { clientStats } from "@/lib/portal/data";
import { Card } from "@/components/ui/card";
import { PrintButton } from "@/app/facture/[id]/print-button";

export const metadata = { title: "Rapport du mois" };
export const dynamic = "force-dynamic";

/** Rapport mensuel imprimable (PDF) pour le client de l'agence. */
export default async function PortalReport({ searchParams }: { searchParams: { mois?: string } }) {
  const s = await requireClientSession();
  const now = new Date();
  const m = /^(\d{4})-(\d{2})$/.exec(searchParams.mois ?? "");
  const start = m ? new Date(Number(m[1]), Number(m[2]) - 1, 1) : new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
  const [stats, before] = await Promise.all([clientStats(s, start), clientStats(s, end)]);
  // Statistiques du mois = depuis le début du mois, moins ce qui suit sa fin.
  const month = {
    calls: stats.calls - before.calls,
    minutes: stats.minutes - before.minutes,
    appointments: stats.appointments - before.appointments,
    leads: stats.leads - before.leads,
    transferred: stats.transferred - before.transferred,
  };
  const label = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(start);
  const fmt = new Intl.NumberFormat("fr-FR");
  const rate = month.calls ? Math.round(((month.calls - month.transferred) / month.calls) * 100) : 0;
  const prev = new Date(start.getFullYear(), start.getMonth() - 1, 1);
  const prevKey = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
  const rows = [
    ["Appels traités", fmt.format(month.calls)],
    ["Minutes de conversation", fmt.format(month.minutes)],
    ["Traités sans intervention humaine", `${rate} %`],
    ["Appels transférés à l'équipe", fmt.format(month.transferred)],
    ["Rendez-vous pris", fmt.format(month.appointments)],
    ["Prospects, messages et rappels", fmt.format(month.leads)],
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <a href={`/espace/rapport?mois=${prevKey}`} className="text-sm text-muted-foreground hover:underline">
          ← Mois précédent
        </a>
        <PrintButton />
      </div>
      <Card className="space-y-6 p-6 print:border-0 print:p-0">
        <header>
          <p className="text-sm text-muted-foreground">{s.org.brandName || s.org.name}</p>
          <h1 className="text-2xl font-semibold tracking-tight">Rapport d&apos;activité · {label}</h1>
          <p className="text-sm text-muted-foreground">{s.client.name}</p>
        </header>
        <table className="w-full text-sm">
          <caption className="sr-only">Indicateurs du mois</caption>
          <tbody>
            {rows.map(([k, v]) => (
              <tr key={k} className="border-b border-border last:border-0">
                <th scope="row" className="py-2.5 text-left font-normal text-muted-foreground">
                  {k}
                </th>
                <td className="py-2.5 text-right tabular-nums text-base font-semibold">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
