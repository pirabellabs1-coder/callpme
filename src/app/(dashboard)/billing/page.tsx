import { Bot, Hash, Clock, ShieldCheck } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { countAgents } from "@/lib/db/agents";
import { extraMinutesBalance, minutesUsedSince, orgSubscription } from "@/lib/billing/limits";
import { TopupPacks } from "@/components/billing/topup-packs";
import { getPlan, limitLabel, UNLIMITED } from "@/lib/billing/plans";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BillingPlans } from "@/components/billing/billing-plans";
import { formatEur } from "@/lib/billing/money";
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
  const sub = await orgSubscription(session.org.id);
  const plan = getPlan(session.org.plan);

  const [agents, numbers, minutesUsed, agencyRow, payments, extraMinutes] = await Promise.all([
    countAgents(session.org.id),
    // Same count as the limit enforced by POST /api/numbers.
    prisma.phoneNumber.count({ where: { organizationId: session.org.id } }),
    minutesUsedSince(session.org.id, sub.periodStart),
    prisma.agencyRequest.findFirst({
      where: { organizationId: session.org.id },
      orderBy: { createdAt: "desc" },
    }),
    prisma.payment.findMany({
      where: { organizationId: session.org.id, status: { in: ["completed", "failed"] } },
      orderBy: { createdAt: "desc" },
      take: 12,
    }),
    extraMinutesBalance(session.org.id),
  ]);
  const dateFmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  const statusText =
    sub.status === "trial"
      ? `Accès démo jusqu'au ${dateFmt.format(sub.endsAt)} (${sub.daysLeft} jour${sub.daysLeft > 1 ? "s" : ""}) : ${sub.minutesIncluded} minutes d'appel offertes par l'équipe Callpme.`
      : sub.status === "active"
        ? `Payé jusqu'au ${dateFmt.format(sub.endsAt)} (${sub.daysLeft} jour${sub.daysLeft > 1 ? "s" : ""}). Renouvelez quand vous voulez : les jours s'ajoutent.`
        : sub.neverPaid
          ? "Aucune offre active : choisissez une offre ci-dessous pour que vos agents prennent des appels. Vous préférez voir Callpme en action d'abord ? Demandez une démo à l'équipe."
          : `Expiré depuis le ${dateFmt.format(sub.endsAt)} : vos agents ne prennent plus d'appels. Vos données sont conservées.`;
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
            <div className="mt-2">
              {sub.status === "trial" ? (
                <Badge variant="brand">Accès démo</Badge>
              ) : sub.status === "active" ? (
                <Badge variant="success">Active</Badge>
              ) : sub.neverPaid ? (
                <Badge variant="muted">Aucune offre</Badge>
              ) : (
                <Badge variant="danger">Expirée</Badge>
              )}
            </div>
            <h2
              id="current-plan-title"
              className="mt-3 text-display-sm font-semibold tracking-tight text-foreground"
            >
              {plan.name}
            </h2>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">{statusText}</p>
          </div>
          <div className="text-right">
            <p className="tabular text-xl font-semibold tracking-tight text-foreground">
              {plan.priceLabel}
              <span className="text-sm font-normal text-muted-foreground"> {plan.period}</span>
            </p>
          </div>
        </div>

        <h3 className="mt-6 text-sm font-medium text-foreground">
          Consommation{" "}
          <span className="font-normal text-muted-foreground">
            · {sub.status === "trial" ? "pendant la démo" : sub.status === "active" ? `depuis le ${dateFmt.format(sub.periodStart)}` : monthLabel}
          </span>
        </h3>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <UsageRow icon={Bot} label="Agents" used={agents} max={sub.plan.maxAgents} />
          <UsageRow icon={Hash} label="Numéros" used={numbers} max={sub.plan.maxNumbers} />
          <UsageRow icon={Clock} label="Minutes" used={minutesUsed} max={sub.minutesIncluded + extraMinutes} unit="min" />
        </div>
      </Card>

      {/* Changement d'offre */}
      <section aria-labelledby="change-plan-title">
        <h2
          id="change-plan-title"
          className="mb-1 text-[0.95rem] font-semibold tracking-tight text-foreground"
        >
          {sub.status === "active" ? "Renouveler ou changer d'offre" : "Choisir une offre"}
        </h2>
        <p className="mb-5 max-w-2xl text-sm text-muted-foreground">
          Starter et Pro se règlent en ligne. L&apos;offre Agence se fait sur devis :
          envoyez une demande, l&apos;équipe fixe le montant, puis vous réglez.
        </p>
        <BillingPlans currentPlan={session.org.plan} status={sub.status} agency={agency} />
      </section>

      {/* Recharges de minutes */}
      <section aria-labelledby="topup-title" className="space-y-3">
        <div>
          <h2 id="topup-title" className="text-[0.95rem] font-semibold tracking-tight text-foreground">
            Recharger des minutes
          </h2>
          <p className="text-sm text-muted-foreground">
            Minutes rechargées disponibles :{" "}
            <span className="tabular font-medium text-foreground">{new Intl.NumberFormat("fr-FR").format(extraMinutes)}</span>
          </p>
        </div>
        <TopupPacks
          disabledReason={sub.status === "expired" ? "Renouvelez d'abord votre offre : les recharges s'utilisent avec une offre active." : undefined}
        />
      </section>

      {/* Historique des paiements */}
      <section aria-labelledby="payments-title">
        <h2 id="payments-title" className="mb-3 text-[0.95rem] font-semibold tracking-tight text-foreground">
          Historique des paiements
        </h2>
        {payments.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun paiement pour le moment.</p>
        ) : (
          <Card className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr className="border-b border-border">
                  <th scope="col" className="px-4 py-2.5 font-medium">Date</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Objet</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">Montant</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Statut</th>
                  <th scope="col" className="px-4 py-2.5 text-right font-medium">
                    <span className="sr-only">Facture</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-2.5 tabular">{dateFmt.format(p.createdAt)}</td>
                    <td className="px-4 py-2.5">
                      {p.kind === "agency"
                        ? "Offre Agence"
                        : p.kind === "topup"
                          ? `Recharge de ${new Intl.NumberFormat("fr-FR").format(p.minutes ?? 0)} minutes`
                          : `Offre ${getPlan(p.plan).name} · 30 jours`}
                      {p.promoCode && <span className="ml-2 font-mono text-xs text-muted-foreground">{p.promoCode}</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular">
                      {formatEur(p.amountEur)}
                    </td>
                    <td className="px-4 py-2.5">
                      {p.status === "completed" ? <Badge variant="success">Payé</Badge> : <Badge variant="danger">Échoué</Badge>}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {p.status === "completed" && p.invoiceNumber && (
                        <a href={`/facture/${p.id}`} target="_blank" rel="noopener" className="text-sm font-medium text-brand hover:underline">
                          Facture
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </section>

      <div className="flex items-start gap-3 rounded-xl border border-border bg-secondary/30 p-4">
        <ShieldCheck className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <p className="text-xs text-muted-foreground text-pretty">
          Paiements sécurisés via GeniusPay (Mobile Money &amp; carte). Tous les prix
          sont en euros. Pour un règlement par Mobile Money, l&apos;opérateur débite
          l&apos;équivalent en monnaie locale, au taux fixe de l&apos;euro.
        </p>
      </div>
    </div>
  );
}
