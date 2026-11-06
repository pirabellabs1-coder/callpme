import { requireClientSession } from "@/lib/auth/session";
import { clientLeads } from "@/lib/portal/data";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata = { title: "Prospects" };
export const dynamic = "force-dynamic";

const KIND: Record<string, string> = { lead: "Prospect", message: "Message", callback: "Rappel demandé", ticket: "Demande" };

export default async function PortalLeads() {
  const s = await requireClientSession();
  const rows = await clientLeads(s);
  const time = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" });
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Prospects et messages</h1>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun prospect ni message pour l&apos;instant.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((l) => (
            <li key={l.id}>
              <Card className="space-y-1 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium">
                    {l.name} {l.phone && <span className="font-mono text-xs text-muted-foreground">{l.phone}</span>}
                  </p>
                  <span className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="muted">{KIND[l.kind] ?? l.kind}</Badge>
                    {time.format(l.createdAt)}
                  </span>
                </div>
                {l.notes && <p className="text-sm text-muted-foreground">{l.notes}</p>}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
