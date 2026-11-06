import { requireClientSession } from "@/lib/auth/session";
import { clientAppointments } from "@/lib/portal/data";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Rendez-vous" };
export const dynamic = "force-dynamic";

export default async function PortalAppointments() {
  const s = await requireClientSession();
  const rows = await clientAppointments(s);
  const time = new Intl.DateTimeFormat("fr-FR", { dateStyle: "full", timeStyle: "short" });
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Rendez-vous</h1>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun rendez-vous pour l&apos;instant.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((a) => (
            <li key={a.id}>
              <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-medium">{a.customerName}</p>
                  <p className="text-sm text-muted-foreground">
                    {time.format(a.startsAt)} {a.customerPhone ? `· ${a.customerPhone}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-muted-foreground">{a.reference}</span>
                  {a.status === "cancelled" ? <Badge variant="danger">Annulé</Badge> : <Badge variant="success">Confirmé</Badge>}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
