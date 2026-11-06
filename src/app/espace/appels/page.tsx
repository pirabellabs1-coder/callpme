import Link from "next/link";
import { requireClientSession } from "@/lib/auth/session";
import { clientCalls } from "@/lib/portal/data";
import { Card } from "@/components/ui/card";

export const metadata = { title: "Appels" };
export const dynamic = "force-dynamic";

export default async function PortalCalls() {
  const s = await requireClientSession();
  const calls = await clientCalls(s, 100);
  const time = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" });
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Appels</h1>
      {calls.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun appel pour l&apos;instant.</p>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <caption className="sr-only">Appels traités par vos assistants</caption>
            <thead className="text-left text-xs text-muted-foreground">
              <tr className="border-b border-border">
                <th scope="col" className="px-4 py-2.5 font-medium">Date</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Numéro</th>
                <th scope="col" className="px-4 py-2.5 font-medium">Issue</th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">Durée</th>
              </tr>
            </thead>
            <tbody>
              {calls.map((c) => (
                <tr key={c.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-2.5 tabular-nums">{time.format(c.createdAt)}</td>
                  <td className="px-4 py-2.5 font-mono text-xs">{c.direction === "outbound" ? c.toNumber : c.fromNumber}</td>
                  <td className="px-4 py-2.5">
                    <Link href={`/espace/appels/${c.id}`} className="font-medium text-brand hover:underline">
                      {c.outcome ?? "Voir l'appel"}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {Math.floor(c.durationSec / 60)} min {String(c.durationSec % 60).padStart(2, "0")} s
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
