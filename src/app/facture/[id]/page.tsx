import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { formatEur } from "@/lib/billing/money";
import { companySchema, type InvoiceSnapshot } from "@/lib/billing/company";
import { invoiceSnapshot } from "@/lib/payments/confirm";
import { paymentLabel } from "@/lib/payments/notify";
import { PrintButton } from "./print-button";

export const metadata = { title: "Facture", robots: { index: false } };
export const dynamic = "force-dynamic";

/** Instantané figé à l'émission ; à défaut (anciennes factures), reconstitué. */
async function snapshotOf(p: { id: string; invoiceData: string | null }): Promise<InvoiceSnapshot | null> {
  if (p.invoiceData) {
    try {
      const s = JSON.parse(p.invoiceData) as InvoiceSnapshot;
      const seller = companySchema.safeParse(s.seller);
      if (seller.success && s.buyer) return { ...s, seller: seller.data };
    } catch {
      /* reconstitution ci-dessous */
    }
  }
  return invoiceSnapshot(p.id);
}

/** Facture d'un paiement confirmé, visible uniquement par son organisation. */
export default async function InvoicePage({ params }: { params: { id: string } }) {
  const session = await requireSession();
  const payment = await prisma.payment.findFirst({
    where: { id: params.id, organizationId: session.org.id, status: "completed", invoiceNumber: { not: null } },
  });
  if (!payment) notFound();
  const snap = await snapshotOf(payment);
  if (!snap) notFound();

  const { seller, buyer } = snap;
  const date = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "Africa/Porto-Novo" }).format(payment.createdAt);
  const label = paymentLabel(payment);
  const vatApplied = snap.vat > 0;
  const sellerLine = [seller.legalForm, seller.capital ? `au capital de ${seller.capital}` : ""].filter(Boolean).join(" ");

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
            <div className="space-y-0.5 text-sm text-neutral-600">
              <p className="text-2xl font-bold text-neutral-900">{seller.legalName}</p>
              {sellerLine && <p>{sellerLine}</p>}
              {seller.address && <p className="whitespace-pre-line">{seller.address}</p>}
              {seller.country && <p>{seller.country}</p>}
              {seller.taxId && <p>IFU : {seller.taxId}</p>}
              {seller.rccm && <p>RCCM : {seller.rccm}</p>}
              {(seller.phone || seller.email) && <p>{[seller.phone, seller.email].filter(Boolean).join(" · ")}</p>}
            </div>
            <div className="text-right">
              <h1 className="text-xl font-semibold">Facture</h1>
              <p className="font-mono text-sm">{payment.invoiceNumber}</p>
              <p className="text-sm text-neutral-600">Date : {date}</p>
            </div>
          </header>

          <section aria-label="Client" className="space-y-0.5 text-sm text-neutral-600">
            <p className="text-xs uppercase tracking-wide text-neutral-500">Facturé à</p>
            <p className="text-base font-medium text-neutral-900">{buyer.name}</p>
            {buyer.address && <p className="whitespace-pre-line">{buyer.address}</p>}
            {buyer.country && <p>{buyer.country}</p>}
            {buyer.taxId && <p>IFU / n° fiscal : {buyer.taxId}</p>}
          </section>

          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-300 text-left">
                <th scope="col" className="py-2 font-medium">Désignation</th>
                <th scope="col" className="py-2 text-right font-medium">Qté</th>
                <th scope="col" className="py-2 text-right font-medium">Prix HT</th>
                <th scope="col" className="py-2 text-right font-medium">Total HT</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-neutral-200">
                <td className="py-3">
                  {label}
                  {payment.promoCode && <span className="block text-xs text-neutral-500">Code promo : {payment.promoCode}</span>}
                </td>
                <td className="py-3 text-right tabular-nums">1</td>
                <td className="py-3 text-right tabular-nums">{formatEur(snap.ht)}</td>
                <td className="py-3 text-right tabular-nums">{formatEur(snap.ht)}</td>
              </tr>
            </tbody>
            <tfoot>
              <tr>
                <th scope="row" colSpan={3} className="pt-4 text-right font-normal text-neutral-600">Total HT</th>
                <td className="pt-4 text-right tabular-nums">{formatEur(snap.ht)}</td>
              </tr>
              <tr>
                <th scope="row" colSpan={3} className="pt-1 text-right font-normal text-neutral-600">
                  {vatApplied ? `TVA (${String(snap.rate).replace(".", ",")} %)` : "TVA"}
                </th>
                <td className="pt-1 text-right tabular-nums">{vatApplied ? formatEur(snap.vat) : formatEur(0)}</td>
              </tr>
              <tr>
                <th scope="row" colSpan={3} className="pt-2 text-right font-semibold">
                  Total TTC payé
                </th>
                <td className="pt-2 text-right text-lg font-semibold tabular-nums">{formatEur(snap.ttc)}</td>
              </tr>
            </tfoot>
          </table>

          <div className="space-y-1 text-xs text-neutral-500">
            {!vatApplied && seller.vatNote && <p>{seller.vatNote}</p>}
            <p>
              {snap.ttc === 0 ? "Offert (code promo)." : "Réglé en euros par Mobile Money ou carte bancaire (GeniusPay)."}
              {payment.reference ? ` Référence de paiement : ${payment.reference}.` : ""}
            </p>
          </div>

          <footer className="border-t border-neutral-200 pt-4 text-xs text-neutral-500">
            <p>Facture acquittée. Merci pour votre confiance.</p>
            {seller.footer && <p className="mt-1 whitespace-pre-line">{seller.footer}</p>}
          </footer>
        </article>
      </main>
    </div>
  );
}
