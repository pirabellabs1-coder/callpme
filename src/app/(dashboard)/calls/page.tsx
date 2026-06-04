import { Suspense } from "react";
import { PhoneCall } from "lucide-react";
import type { CallDirection, CallStatus } from "@/lib/shared/types";
import { getCurrentOrg } from "@/lib/db/context";
import { listCalls } from "@/lib/db/calls";
import { listAgents } from "@/lib/db/agents";
import { PageHeader } from "@/components/dashboard/page-header";
import { SeedNotice } from "@/components/dashboard/seed-notice";
import { CallsFilterBar } from "@/components/calls/calls-filter-bar";
import { CallRow } from "@/components/calls/call-row";
import { EmptyState } from "@/components/ui/empty-state";
import { Card } from "@/components/ui/card";

export const metadata = { title: "Appels" };

const STATUSES: CallStatus[] = [
  "completed",
  "transferred",
  "failed",
  "missed",
  "in_progress",
];
const DIRECTIONS: CallDirection[] = ["inbound", "outbound"];

export default async function CallsPage({
  searchParams,
}: {
  searchParams: {
    agentId?: string;
    status?: string;
    direction?: string;
    search?: string;
  };
}) {
  const org = await getCurrentOrg();
  if (!org) return <SeedNotice />;

  const status =
    searchParams.status && STATUSES.includes(searchParams.status as CallStatus)
      ? (searchParams.status as CallStatus)
      : undefined;
  const direction =
    searchParams.direction &&
    DIRECTIONS.includes(searchParams.direction as CallDirection)
      ? (searchParams.direction as CallDirection)
      : undefined;

  const [agents, calls] = await Promise.all([
    listAgents(org.id),
    listCalls(org.id, {
      agentId: searchParams.agentId || undefined,
      status,
      direction,
      search: searchParams.search?.trim() || undefined,
      limit: 200,
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Appels"
        description="Historique complet des appels traités par vos agents."
      />

      <Suspense fallback={<div className="h-10" />}>
        <CallsFilterBar
          agents={agents.map((a) => ({ id: a.id, name: a.name }))}
        />
      </Suspense>

      <p className="text-sm text-muted-foreground">
        {calls.length} appel{calls.length > 1 ? "s" : ""}
      </p>

      {calls.length === 0 ? (
        <EmptyState
          icon={PhoneCall}
          title="Aucun appel"
          description="Aucun appel ne correspond à ces critères."
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="hidden items-center gap-4 border-b border-border bg-secondary/40 px-5 py-2.5 text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground sm:flex">
            <span className="size-8" />
            <span className="flex-1">Agent / Issue</span>
            <span className="w-28">Direction</span>
            <span className="hidden w-36 md:block">Numéro</span>
            <span className="w-16 text-right">Durée</span>
            <span className="hidden w-28 text-right lg:block">Date</span>
            <span className="w-24 text-right">Statut</span>
            <span className="w-8" />
          </div>
          <div className="divide-y divide-border">
            {calls.map((call) => (
              <CallRow key={call.id} call={call} />
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
