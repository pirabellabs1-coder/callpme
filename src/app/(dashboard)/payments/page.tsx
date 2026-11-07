import { headers } from "next/headers";
import Link from "next/link";
import { Wallet } from "lucide-react";
import { isOrgAdmin, requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { decryptSecret } from "@/lib/crypto/secrets";
import { asCurrency, formatAmount, parseItems } from "@/lib/payments/merchant-rules";
import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PaymentSettings } from "@/components/payments/payment-settings";

export const metadata = { title: "Paiements" };
export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; variant: "success" | "warning" | "danger" }> = {
  completed: { label: "Payé", variant: "success" },
  pending: { label: "En attente", variant: "warning" },
  failed: { label: "Échoué", variant: "danger" },
};

const maskPhone = (p: string) => (p.length > 4 ? `${"•".repeat(Math.max(0, p.length - 4))}${p.slice(-4)}` : p);

export default async function PaymentsPage() {
  const session = await requireSession();
  const admin = isOrgAdmin(session);
  const [settings, wa, requests] = await Promise.all([
    prisma.paymentSettings.findUnique({ where: { organizationId: session.org.id } }),
    prisma.whatsAppChannel.findUnique({ where: { organizationId: session.org.id }, select: { enabled: true } }),
    prisma.paymentRequest.findMany({
      where: { organizationId: session.org.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, amount: true, currency: true, reason: true, status: true, customerPhone: true, channel: true, callRef: true, createdAt: true, paidAt: true },
    }),
  ]);
  // Lien vers la fiche d'appel quand l'appel est enregistré (callRef = id de l'appel).
  const refs = requests.map((r) => r.callRef).filter((r): r is string => Boolean(r));
  const calls = refs.length
    ? await prisma.call.findMany({ where: { id: { in: refs }, agent: { organizationId: session.org.id } }, select: { id: true } })
    : [];
  const known = new Set(calls.map((c) => c.id));

  const h = headers();
  const appUrl = (process.env.PUBLIC_URL || `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`).replace(/\/$/, "");
  const currency = asCurrency(settings?.currency);
  const date = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "Africa/Porto-Novo" });
  const total = requests.filter((r) => r.status === "completed").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Paiements"
        description="Vos agents encaissent pendant l'appel : ils envoient un lien Mobile Money ou carte, payé directement sur votre compte GeniusPay."
        breadcrumb={[{ label: "Paiements" }]}
      />

      <Card className="space-y-4 p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <Wallet className="size-5 text-brand" aria-hidden />
          <h2 className="text-base font-semibold">Compte GeniusPay de l&apos;entreprise</h2>
        </div>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Activez ensuite l&apos;outil « Encaisser un paiement » (et « Vérifier un paiement ») dans les outils de l&apos;agent, sur{" "}
          <Link href="/agents" className="font-medium text-brand hover:underline">
            la page de l&apos;agent
          </Link>
          . Les conversations de test n&apos;envoient jamais de lien.
        </p>
        <PaymentSettings
          canEdit={admin}
          whatsappConnected={Boolean(wa?.enabled)}
          settings={
            settings
              ? {
                  enabled: settings.enabled,
                  currency,
                  maxAmount: settings.maxAmount,
                  allowCustomAmount: settings.allowCustomAmount,
                  delivery: settings.delivery === "whatsapp" ? "whatsapp" : "sms",
                  itemsText: parseItems(settings.items).map((i) => `${i.label} = ${i.amount}`).join("\n"),
                  webhookUrl: admin ? `${appUrl}/api/payments/merchant/${settings.webhookToken}` : "",
                  sandbox: admin ? (decryptSecret(settings.apiKey) ?? "").startsWith("pk_sandbox_") : false,
                }
              : null
          }
        />
      </Card>

      <Card className="p-5 sm:p-6">
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold">Demandes de paiement</h2>
          <p className="text-sm text-muted-foreground">{total} payée{total > 1 ? "s" : ""} sur les 50 dernières</p>
        </div>
        {requests.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune demande pour l&apos;instant.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th scope="col" className="py-2 pr-4 font-medium">Date</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Montant</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Motif</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Client</th>
                  <th scope="col" className="py-2 pr-4 font-medium">Statut</th>
                  <th scope="col" className="py-2 font-medium">Appel</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {requests.map((r) => {
                  const s = STATUS[r.status] ?? STATUS.pending;
                  return (
                    <tr key={r.id}>
                      <td className="py-2 pr-4 whitespace-nowrap text-muted-foreground">{date.format(r.createdAt)}</td>
                      <td className="py-2 pr-4 whitespace-nowrap font-medium">{formatAmount(r.amount, asCurrency(r.currency))}</td>
                      <td className="py-2 pr-4">{r.reason}</td>
                      <td className="py-2 pr-4 whitespace-nowrap mono">
                        {maskPhone(r.customerPhone)}
                        {r.channel === "whatsapp" ? " · WhatsApp" : r.channel === "sms" ? " · SMS" : ""}
                      </td>
                      <td className="py-2 pr-4">
                        <Badge variant={s.variant}>{s.label}</Badge>
                      </td>
                      <td className="py-2">
                        {r.callRef && known.has(r.callRef) ? (
                          <Link href={`/calls/${r.callRef}`} className="font-medium text-brand hover:underline">
                            Voir
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">{r.status === "pending" ? "En cours" : "—"}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
