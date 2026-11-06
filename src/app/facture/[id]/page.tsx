import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { getPlan } from "@/lib/billing/plans";
import { getCountry } from "@/lib/geo/countries";
import { PrintButton } from "./print-button";

export const metadata = { title: "Facture", robots: { index: false } };
export const dynamic = "force-dynamic";

/** Facture d'un paiement confirmé, visible uniquement par son organisation. */
export default async function InvoicePage({ params }: { params: { id: string } }) {
  const session = await requireSession();
  const payment = await prisma.payment.findFirst({
    where: { id: params.id, organizationId: session.org.id, status: "completed", invoiceNumber: { not: null } },
    include: { organization: { select: { name: true, country: true } } },
  });
  if (!payment) notFound();

  const seller = {
    name: process.env.INVOICE_SELLER_NAME || "Callpme",
    address: process.env.INVOICE_SELLER_ADDRESS || "",
    taxId: process.env.INVOICE_SELLER_TAX_ID || "",
    email: process.env.INVOICE_SELLER_EMAIL || process.env.CONTACT_TO || "",
  };
  const fmt = new Intl.NumberFormat("fr-FR");
  const date = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(payment.createdAt);
  const label =
    payment.kind === "topup"
      ? `Recharge de ${fmt.format(payment.minutes ?? 0)} minutes d'appel`
      : payment.kind === "agency"
        ? "Offre Agence (sur devis)"
        : `Abonnement ${getPlan(payment.plan).name} · 30 jours`;

  return (
    <div className="min-h-dvh bg-white">
    <main className="mx-auto max-w-3xl bg-white px-6 py-10 text-neutral-900 print:px-0 print:py-0">
      <div className="mb-8 flex items-center justify-between print:hidden">
        <a href="/billing" className="text-sm text-neutral-600 hover:underline">
          ← Retour à la facturation
        </a>
        <PrintButton />
      </div>
      <article className="space-y-8 rounded-2xl border border-neutral-200 p-8 print:border-0 print:p-0" aria-label={`Facture ${payment.invoiceNumber}`}>
        <header className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="text-2xl font-bold">{seller.name}</p>
            {seller.address && <p className="whitespace-pre-line text-sm text-neutral-600">{seller.address}</p>}
            {seller.taxId && <p className="text-sm text-neutral-600">IFU / n° fiscal : {seller.taxId}</p>}
            {seller.email && <p className="text-sm text-neutral-600">{seller.email}</p>}
          </div>
          <div className="text-right">
            <h1 className="text-xl font-semibold">Facture</h1>
            <p className="font-mono text-sm">{payment.invoiceNumber}</p>
            <p className="text-sm text-neutral-600">Date : {date}</p>
          </div>
        </header>

        <section aria-label="Client">
          <p className="text-xs uppercase tracking-wide text-neutral-500">Facturé à</p>
          <p className="font-medium">{payment.organization.name}</p>
          <p className="text-sm text-neutral-600">{getCountry(payment.organization.country).name}</p>
        </section>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-300 text-left">
              <th scope="col" className="py-2 font-medium">Désignation</th>
              <th scope="col" className="py-2 text-right font-medium">Montant</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-neutral-200">
              <td className="py-3">
                {label}
                {payment.promoCode && <span className="block text-xs text-neutral-500">Code promo : {payment.promoCode}</span>}
              </td>
              <td className="py-3 text-right tabular-nums">{fmt.format(payment.amountXof)} FCFA</td>
            </tr>
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" className="pt-4 text-left font-semibold">
                Total payé
              </th>
              <td className="pt-4 text-right text-lg font-semibold tabular-nums">{fmt.format(payment.amountXof)} FCFA</td>
            </tr>
            <tr>
              <td colSpan={2} className="pt-1 text-right text-xs text-neutral-500">
                ≈ {fmt.format(payment.amountEur)} € · {payment.amountXof === 0 ? "offert" : "réglé par Mobile Money ou carte (GeniusPay)"}
                {payment.reference ? ` · réf. ${payment.reference}` : ""}
              </td>
            </tr>
          </tfoot>
        </table>

        <footer className="border-t border-neutral-200 pt-4 text-xs text-neutral-500">
          Facture acquittée. Merci pour votre confiance.
        </footer>
      </article>
    </main>
    </div>
  );
}
