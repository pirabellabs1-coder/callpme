import { notFound } from "next/navigation";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { prisma } from "@/lib/db/client";
import { confirmPaymentRequest } from "@/lib/payments/merchant";
import { asCurrency, formatAmount } from "@/lib/payments/merchant-rules";
import { clientIp, isRateLimited } from "@/lib/security/rate-limit";

export const metadata = { title: "Paiement", robots: { index: false } };
export const dynamic = "force-dynamic";

/**
 * Page de retour publique après un paiement GeniusPay demandé pendant un
 * appel. N'affiche que l'entreprise, le montant et le statut (relu auprès
 * de GeniusPay) : ni motif (données possiblement sensibles), ni numéro, ni référence.
 */
export default async function PaymentReturnPage({ params }: { params: { id: string } }) {
  if (!/^[a-z0-9]{20,40}$/i.test(params.id)) notFound();
  const limited = isRateLimited(`pay-return:${clientIp()}`, 30, 10 * 60_000);
  const req = await prisma.paymentRequest.findUnique({
    where: { id: params.id },
    select: { id: true, amount: true, currency: true, status: true, organization: { select: { name: true } } },
  });
  if (!req) notFound();
  const status = limited ? req.status : ((await confirmPaymentRequest(req.id).catch(() => null)) ?? req.status);
  const amount = formatAmount(req.amount, asCurrency(req.currency));

  const view =
    status === "completed"
      ? { Icon: CheckCircle2, color: "text-emerald-600", title: "Paiement reçu", text: "Merci ! Votre paiement a bien été reçu. Vous pouvez fermer cette page." }
      : status === "failed"
        ? { Icon: XCircle, color: "text-destructive", title: "Paiement non abouti", text: "Le paiement a échoué ou a été annulé. Aucun montant n'a été prélevé. Contactez l'entreprise pour recevoir un nouveau lien." }
        : { Icon: Clock, color: "text-amber-600", title: "Paiement en cours de validation", text: "Si vous avez validé le paiement sur votre téléphone, il sera confirmé dans quelques instants. Actualisez la page pour voir son statut." };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
        <view.Icon className={`mx-auto size-12 ${view.color}`} aria-hidden />
        <h1 className="mt-4 text-xl font-semibold">{view.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{view.text}</p>
        <dl className="mt-6 space-y-2 rounded-xl bg-secondary/40 p-4 text-left text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Bénéficiaire</dt>
            <dd className="font-medium">{req.organization.name}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Montant</dt>
            <dd className="font-medium">{amount}</dd>
          </div>
        </dl>
        <p className="mt-6 text-xs text-muted-foreground">Paiement sécurisé par GeniusPay. Callpme ne voit jamais vos données de paiement.</p>
      </div>
    </main>
  );
}
