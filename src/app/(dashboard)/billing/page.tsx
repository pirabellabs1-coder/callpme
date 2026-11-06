import { Bot, Hash, Clock, ShieldCheck } from "lucide-react";
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
  const ratio = unlimited ? 0 : used / Math.max(max, 1);
  const pct = Math.min(ratio * 100, 100);
  const over = !unlimited && used >= max;
  const near = !unlimited && !over && ratio >= 0.8;
  const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n);
  const suffix = unit ? ` ${unit}` : "";
  const valueText = unlimited
    ? `${fmt(used)}${suffix} utilisés, illimité`
    : `${fmt(used)} sur ${fmt(max)}${suffix}`;

  return (
    <div className="rounded-xl border border-border bg-secondary/30 p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <Icon className="size-4" strokeWidth={1.75} aria-hidden="true" />
          {label}
        </span>
        {over ? (
          <Badge variant="danger">Limite atteinte</Badge>
        ) : near ? (
          <Badge variant="warning">Bientôt atteinte</Badge>
        ) : null}
      </div>
      <p className="mt-2 tabular text-xl font-semibold tracking-tight text-foreground">
        {fmt(used)}
        <span className="text-sm font-normal text-muted-foreground">
          {" "}
          / {unlimited ? limitLabel(max) : fmt(max)}
          {suffix}
        </span>
      </p>
      {unlimited ? (
        <p className="mt-3 text-xs text-muted-foreground">Aucune limite sur cette offre.</p>
      ) : (
        <div
          role="progressbar"
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={max}
          aria-valuenow={Math.min(used, max)}
          aria-valuetext={valueText}
          className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary"
        >
          <div
            className={cn(
              "h-full rounded-full",
              over ? "bg-destructive" : near ? "bg-warning" : "bg-brand",
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}

export default async function BillingPage() {
  const session = await requireSession();
  const plan = getPlan(session.org.plan);

  const [agents, numbers, minutesUsed, agencyRow] = await Promise.all([
    countAgents(session.org.id),
    // Same count as the limit enforced by POST /api/numbers.
    prisma.phoneNumber.count({ where: { organizationId: session.org.id } }),
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

  const monthLabel = new Intl.DateTimeFormat("fr-FR", {
    month: "long",
    year: "numeric",
  }).format(new Date());

  return (
    <div className="space-y-8">
      <PageHeader
        title="Facturation"
        description="Votre offre, votre consommation et le changement d'offre."
      />

      {/* Offre courante + consommation */}
      <Card className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="eyebrow">Offre actuelle</p>
            <h2
              id="current-plan-title"
              className="mt-3 text-display-sm font-semibold tracking-tight text-foreground"
            >
              {plan.name}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{plan.tagline}</p>
          </div>
          <div className="text-right">
            <p className="tabular text-xl font-semibold tracking-tight text-foreground">
              {plan.priceLabel}
              <span className="text-sm font-normal text-muted-foreground"> {plan.period}</span>
            </p>
            {plan.priceMonthly != null && (
              <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                ≈ {new Intl.NumberFormat("fr-FR").format(Math.round(plan.priceMonthly * EUR_TO_XOF))}{" "}
                FCFA / mois
              </p>
            )}
          </div>
        </div>

        <h3 className="mt-6 text-sm font-medium text-foreground">
          Consommation <span className="font-normal text-muted-foreground">· {monthLabel}</span>
        </h3>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <UsageRow icon={Bot} label="Agents" used={agents} max={plan.maxAgents} />
          <UsageRow icon={Hash} label="Numéros" used={numbers} max={plan.maxNumbers} />
          <UsageRow
            icon={Clock}
            label="Minutes ce mois-ci"
            used={minutesUsed}
            max={plan.minutes}
            unit="min"
          />
        </div>
      </Card>

      {/* Changement d'offre */}
      <section aria-labelledby="change-plan-title">
        <h2
          id="change-plan-title"
          className="mb-1 text-[0.95rem] font-semibold tracking-tight text-foreground"
        >
          Changer d&apos;offre
        </h2>
        <p className="mb-5 max-w-2xl text-sm text-muted-foreground">
          Starter et Pro se règlent en ligne. L&apos;offre Agence se fait sur devis :
          envoyez une demande, l&apos;équipe fixe le montant, puis vous réglez.
        </p>
        <BillingPlans currentPlan={session.org.plan} agency={agency} xofRate={EUR_TO_XOF} />
      </section>

      <div className="flex items-start gap-3 rounded-xl border border-border bg-secondary/30 p-4">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <p className="text-xs text-muted-foreground text-pretty">
          Paiements sécurisés via GeniusPay (mobile money &amp; carte). Les prix sont
          affichés en euros ; le montant est débité en FCFA à l&apos;équivalent, avec
          aperçu avant paiement.
        </p>
      </div>
    </div>
  );
}
