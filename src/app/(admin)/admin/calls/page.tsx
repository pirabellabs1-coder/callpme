import Link from "next/link";
import { listAllCalls } from "@/lib/db/admin";
import { formatDuration } from "@/lib/utils";
import { CallStatusBadge, DirectionBadge } from "@/components/status-badges";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card } from "@/components/ui/card";
import type { CallDirection, CallStatus } from "@/lib/shared/types";

export const metadata = { title: "Appels" };
export const dynamic = "force-dynamic";

const fmt = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" });

export default async function AdminCallsPage() {
  const calls = await listAllCalls(150);
  return (
    <div className="space-y-6">
      <PageHeader
        title="Appels"
        description="Tous les appels de la plateforme, toutes organisations confondues."
      />
      <Card className="overflow-hidden">
        <div className="divide-y divide-border">
          {calls.map((c) => (
            <Link
              key={c.id}
              href={`/calls/${c.id}`}
              className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-accent/40"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {c.agentName} <span className="text-muted-foreground">· {c.orgName}</span>
                </p>
                <p className="truncate text-xs text-muted-foreground">{c.outcome ?? "—"}</p>
              </div>
              <div className="hidden w-24 sm:block">
                <DirectionBadge direction={c.direction as CallDirection} />
              </div>
              <span className="hidden w-16 text-right text-xs tabular text-muted-foreground sm:block">
                {formatDuration(c.durationSec)}
              </span>
              <span className="hidden w-28 text-right text-xs text-muted-foreground lg:block">
                {fmt.format(new Date(c.createdAt))}
              </span>
              <div className="w-24 text-right">
                <CallStatusBadge status={c.status as CallStatus} />
              </div>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}
