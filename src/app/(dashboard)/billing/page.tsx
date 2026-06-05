import { Bot, Hash, Clock, Info } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { countAgents } from "@/lib/db/agents";
import { monthlyMinutesUsed } from "@/lib/billing/limits";
import { getPlan, limitLabel, UNLIMITED } from "@/lib/billing/plans";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BillingPlans } from "@/components/billing/billing-plans";
import { EUR_TO_XOF } from "@/lib/payments/geniuspay";
import { cn } from "@/lib/utils";

export const metadata = { title: "Facturation" };
export const dynamic = "force-dynamic";

function UsageRow({
  icon: Icon,
  label,
  used,
  max,
  unit,
}: {
  icon: typeof Bot;
  label: string;
  used: number;
  max: number;
  unit?: string;
}) {
  const unlimited = max >= UNLIMITED;
  const pct = unlimited ? 8 : Math.min((used / Math.max(max, 1)) * 100, 100);
  const over = !unlimited && used >= max;

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
        <span className="inline-flex items-center gap-2 text-foreground">
          <Icon className="size-4 text-muted-foreground" strokeWidth={1.75} />
          {label}
        </span>
        <span className={cn("tabular", over ? "text-destructive" : "text-muted-foreground")}>
          {used} {unit} / {limitLabel(max)} {!unlimited && unit ? unit : ""}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-secondary">
        <div
          className={cn(
            "h-full rounded-full",
            over ? "bg-destructive" : "bg-brand",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default async function BillingPage() {
  const session = await requireSession();
  const plan = getPlan(session.org.plan);

  const [agents, numbers, minutesUsed, agencyRow] = await Promise.all([
    countAgents(session.org.id),
    prisma.agent.count({
      where: { organizationId: session.org.id, phoneNumber: { not: null } },
    }),
    monthlyMinutesUsed(session.org.id),
    prisma.agencyRequest.findFirst({
      where: { organizationId: session.org.id },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  const agency = agencyRow
    ? {
        id: agencyRow.id,
        status: agencyRow.status,
        quotedAmountEur: agencyRow.quotedAmountEur,
        adminNote: agencyRow.adminNote,
      }
    : null;

  return (
    <div className="space-y-7">
      <PageHeader
        title="Facturation"
        description="Votre offre, votre consommation et le changement d'offre."
      />

      {/* Offre courante + consommation */}
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h2 className="text-[0.95rem] font-semibold tracking-tight">
              Offre actuelle
            </h2>
            <Badge variant="brand">{plan.name}</Badge>
          </div>
          <span className="text-sm text-muted-foreground">
            {plan.priceLabel} {plan.period}
          </span>
        </div>
        <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-3">
          <UsageRow icon={Bot} label="Agents" used={agents} max={plan.maxAgents} />
          <UsageRow icon={Hash} label="Numéros" used={numbers} max={plan.maxNumbers} />
          <UsageRow icon={Clock} label="Minutes" used={minutesUsed} max={plan.minutes} unit="" />
        </div>
      </Card>

      {/* Changement d'offre */}
      <div>
        <h2 className="mb-1 text-[0.95rem] font-semibold tracking-tight">
          Changer d'offre
        </h2>
        <p className="mb-5 text-sm text-muted-foreground">
          Starter et Pro se règlent en ligne. L'offre Agence se fait sur devis :
          envoyez une demande, l'équipe fixe le montant, puis vous réglez.
        </p>
        <BillingPlans
          currentPlan={session.org.plan}
          agency={agency}
          xofRate={EUR_TO_XOF}
        />
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-border bg-secondary/30 p-4">
        <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">
          Paiements sécurisés via GeniusPay (mobile money & carte). Les prix sont
          affichés en euros ; le montant est débité en FCFA à l'équivalent, avec
          aperçu avant paiement.
        </p>
      </div>
    </div>
  );
}
