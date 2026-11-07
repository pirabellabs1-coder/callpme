import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { NumberMarketAdmin } from "@/components/admin/number-market-admin";
import { marketCountry } from "@/lib/numbers/market";

export const dynamic = "force-dynamic";
export const metadata = { title: "Marketplace numéros" };

const STOCK_STATUSES = ["available", "reserved", "assigned", "disabled"];

/**
 * Marketplace des numéros : stock fourni par les opérateurs partenaires et
 * demandes des clients. Attribuer = le numéro est créé, actif, chez le client.
 * À faire seulement quand le numéro est raccordé (trunk SIP de l'opérateur).
 */
export default async function AdminNumberMarketPage({
  searchParams,
}: {
  searchParams: { pays?: string; statut?: string };
}) {
  await requireAdmin();
  const country = marketCountry(searchParams.pays) ? searchParams.pays! : undefined;
  const status = STOCK_STATUSES.includes(searchParams.statut ?? "") ? searchParams.statut : undefined;

  const pending = await prisma.numberRequest.findMany({
    where: { status: "pending" },
    orderBy: { createdAt: "asc" },
    include: { organization: { select: { name: true, plan: true } } },
    take: 100,
  });
  // Numéros disponibles, seulement pour les pays des demandes en attente.
  const pendingCountries = Array.from(new Set(pending.map((p) => p.country)));
  const [processed, stock, counts, available] = await Promise.all([
    prisma.numberRequest.findMany({
      where: { status: { not: "pending" } },
      orderBy: { updatedAt: "desc" },
      include: { organization: { select: { name: true } } },
      take: 20,
    }),
    prisma.numberStock.findMany({
      where: { ...(country ? { country } : {}), ...(status ? { status } : {}) },
      orderBy: [{ country: "asc" }, { network: "asc" }, { number: "asc" }],
      take: 300,
    }),
    prisma.numberStock.groupBy({ by: ["status"], _count: { _all: true } }),
    pendingCountries.length
      ? prisma.numberStock.findMany({
          where: { status: "available", country: { in: pendingCountries } },
          orderBy: [{ country: "asc" }, { number: "asc" }],
          select: { id: true, number: true, country: true, network: true, monthlyPriceXof: true },
          take: 3000,
        })
      : Promise.resolve([]),
  ]);

  const stockById = new Map(stock.map((s) => [s.id, s.number]));
  const reservedIds = pending.map((p) => p.stockId).filter((x): x is string => !!x && !stockById.has(x));
  const reserved = reservedIds.length
    ? await prisma.numberStock.findMany({ where: { id: { in: reservedIds } }, select: { id: true, number: true } })
    : [];
  for (const r of reserved) stockById.set(r.id, r.number);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-display-sm font-semibold tracking-tight">Marketplace numéros</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ajoutez les numéros fournis par les opérateurs partenaires, puis attribuez-les aux clients. N&apos;attribuez un
          numéro qu&apos;une fois raccordé : il devient actif chez le client immédiatement.
        </p>
      </div>
      <NumberMarketAdmin
        counts={Object.fromEntries(counts.map((c) => [c.status, c._count._all]))}
        filters={{ country: country ?? "", status: status ?? "" }}
        pending={pending.map((p) => ({
          id: p.id,
          org: p.organization.name,
          plan: p.organization.plan,
          country: p.country,
          network: p.network,
          desiredPrefix: p.desiredPrefix,
          stockId: p.stockId,
          stockNumber: p.stockId ? stockById.get(p.stockId) ?? null : null,
          companyName: p.companyName,
          contactName: p.contactName,
          contactPhone: p.contactPhone,
          contactEmail: p.contactEmail,
          businessId: p.businessId,
          taxId: p.taxId,
          address: p.address,
          usage: p.usage,
          createdAt: p.createdAt.toISOString(),
        }))}
        processed={processed.map((p) => ({
          id: p.id,
          org: p.organization.name,
          country: p.country,
          status: p.status,
          assignedNumber: p.assignedNumber,
          adminNote: p.adminNote,
          updatedAt: p.updatedAt.toISOString(),
        }))}
        stock={stock.map((s) => ({
          id: s.id,
          number: s.number,
          country: s.country,
          network: s.network,
          kind: s.kind,
          monthlyPriceXof: s.monthlyPriceXof,
          setupPriceXof: s.setupPriceXof,
          status: s.status,
          note: s.note,
        }))}
        available={available}
      />
    </div>
  );
}
