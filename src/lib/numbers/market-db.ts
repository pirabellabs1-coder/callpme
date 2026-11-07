/**
 * Marketplace des numéros — accès base (serveur uniquement).
 *
 * Cycle d'un numéro du stock :
 *   available → reserved (demande d'un client) → assigned (validée par l'admin)
 *   reserved → available (demande refusée ou annulée)
 *   assigned → available (le client supprime le numéro)
 * Chaque transition passe par un updateMany conditionnel : deux demandes ne
 * peuvent pas réserver ni recevoir le même numéro.
 */
import { prisma } from "../db/client";
import { getPlan } from "../billing/plans";
import {
  MAX_OPEN_REQUESTS,
  marketCountry,
  matchesPrefix,
  networkLabel,
  parseStockList,
  xofToEur,
  cleanPrefix,
  type NumberRequestInput,
} from "./market";

export class MarketError extends Error {}

export interface StockOffer {
  id: string;
  number: string;
  country: string;
  network: string;
  kind: string;
  monthlyPriceXof: number;
  setupPriceXof: number;
}

const OFFER_SELECT = {
  id: true,
  number: true,
  country: true,
  network: true,
  kind: true,
  monthlyPriceXof: true,
  setupPriceXof: true,
} as const;

/** Numéros disponibles, filtrés par pays, réseau, type et début du numéro (60 au plus). */
export async function searchStock(f: {
  country: string;
  network?: string;
  kind?: string;
  prefix?: string;
}): Promise<StockOffer[]> {
  const c = marketCountry(f.country);
  if (!c) return [];
  const prefix = cleanPrefix(f.prefix);
  const starts = prefix ? prefixStarts(c.dial, prefix) : null;
  const rows = await prisma.numberStock.findMany({
    where: {
      status: "available",
      country: f.country,
      ...(f.network ? { network: f.network } : {}),
      ...(f.kind ? { kind: f.kind } : {}),
      ...(starts ? { OR: starts.map((st) => ({ number: { startsWith: st } })) } : {}),
    },
    orderBy: [{ monthlyPriceXof: "asc" }, { number: "asc" }],
    select: OFFER_SELECT,
    take: 200,
  });
  // Double contrôle (mêmes règles que l'affichage côté navigateur).
  return rows.filter((r) => matchesPrefix(r.number, r.country, prefix)).slice(0, 60);
}

/** Débuts de numéro E.164 qui correspondent à un préfixe (avec ou sans 0 / 01 de tête). */
export function prefixStarts(dial: string, prefix: string): string[] {
  return Array.from(new Set([`+${dial}${prefix}`, `+${dial}0${prefix}`, `+${dial}01${prefix}`]));
}

/** Réseaux qui ont au moins un numéro disponible, par pays (pour l'affichage). */
export async function stockAvailability(): Promise<Record<string, number>> {
  const rows = await prisma.numberStock.groupBy({
    by: ["country"],
    where: { status: "available" },
    _count: { _all: true },
  });
  return Object.fromEntries(rows.map((r) => [r.country, r._count._all]));
}

/** Enregistre la demande d'un client ; réserve le numéro choisi s'il y en a un. */
export async function createNumberRequest(
  org: { id: string; plan: string },
  userId: string,
  input: NumberRequestInput,
): Promise<{ id: string }> {
  const [open, owned] = await Promise.all([
    prisma.numberRequest.count({ where: { organizationId: org.id, status: "pending" } }),
    prisma.phoneNumber.count({ where: { organizationId: org.id } }),
  ]);
  if (open >= MAX_OPEN_REQUESTS) {
    throw new MarketError(`Vous avez déjà ${MAX_OPEN_REQUESTS} demandes en cours : attendez leur traitement.`);
  }
  const plan = getPlan(org.plan);
  if (owned + open >= plan.maxNumbers) {
    throw new MarketError(`Votre offre ${plan.name} permet ${plan.maxNumbers} numéro(s) : passez à une offre supérieure.`);
  }

  return prisma.$transaction(async (tx) => {
    // Recompte dans la transaction (demandes envoyées en parallèle).
    const openNow = await tx.numberRequest.count({ where: { organizationId: org.id, status: "pending" } });
    if (openNow >= MAX_OPEN_REQUESTS || owned + openNow >= plan.maxNumbers) {
      throw new MarketError("Limite de demandes atteinte : attendez le traitement des demandes en cours.");
    }
    let network = input.network;
    if (input.stockId) {
      const stock = await tx.numberStock.findUnique({ where: { id: input.stockId } });
      if (!stock || stock.country !== input.country) throw new MarketError("Ce numéro n'est plus disponible.");
      network = stock.network;
    }
    const request = await tx.numberRequest.create({
      data: {
        organizationId: org.id,
        userId,
        country: input.country,
        network: network ?? null,
        desiredPrefix: cleanPrefix(input.desiredPrefix) || null,
        stockId: input.stockId ?? null,
        companyName: input.companyName,
        contactName: input.contactName,
        contactPhone: input.contactPhone,
        contactEmail: input.contactEmail,
        businessId: input.businessId ?? null,
        taxId: input.taxId ?? null,
        address: input.address,
        usage: input.usage ?? null,
      },
      select: { id: true },
    });
    if (input.stockId) {
      const reserved = await tx.numberStock.updateMany({
        where: { id: input.stockId, status: "available" },
        data: { status: "reserved", requestId: request.id },
      });
      if (reserved.count !== 1) throw new MarketError("Ce numéro vient d'être réservé par un autre client.");
    }
    return request;
  });
}

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/** Libère le numéro réservé par une demande (refus ou annulation). */
async function releaseReservation(tx: Tx, requestId: string) {
  await tx.numberStock.updateMany({
    where: { requestId, status: "reserved" },
    data: { status: "available", requestId: null },
  });
}

/** Le client annule une demande encore en attente (et libère le numéro réservé). */
export async function cancelNumberRequest(orgId: string, id: string): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const done = await tx.numberRequest.updateMany({
      where: { id, organizationId: orgId, status: "pending" },
      data: { status: "cancelled" },
    });
    if (done.count !== 1) return false;
    await releaseReservation(tx, id);
    return true;
  });
}

export async function listOrgNumberRequests(orgId: string) {
  return prisma.numberRequest.findMany({
    where: { organizationId: orgId },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: {
      id: true,
      country: true,
      network: true,
      desiredPrefix: true,
      status: true,
      adminNote: true,
      assignedNumber: true,
      createdAt: true,
      stockId: true,
    },
  });
}

/**
 * Un numéro du stock retiré par son client revient dans le stock, en pause :
 * l'admin le remet en vente après un délai (les anciens contacts du client
 * ne doivent pas tomber tout de suite sur un autre client).
 */
export async function returnToStock(orgId: string, number: string) {
  await prisma.numberStock.updateMany({
    where: { number, organizationId: orgId, status: "assigned" },
    data: { status: "disabled", organizationId: null, requestId: null, note: `Rendu le ${new Date().toLocaleDateString("fr-FR")}` },
  });
}

/** Tous les numéros attribués à une organisation reviennent en stock (purge, suppression). */
export async function returnAllToStock(orgId: string) {
  await prisma.numberStock.updateMany({
    where: { organizationId: orgId, status: "assigned" },
    data: { status: "disabled", organizationId: null, requestId: null, note: "Rendu (organisation purgée)" },
  });
}

/* --------------------------------- Admin --------------------------------- */

/** Ajoute des numéros au stock ; ignore ceux déjà en stock ou déjà utilisés. */
export async function importStock(o: {
  country: string;
  network: string;
  kind: string;
  monthlyPriceXof: number;
  setupPriceXof: number;
  numbers: string;
  note?: string;
}): Promise<{ added: number; skipped: number; invalid: string[] }> {
  const { valid, invalid } = parseStockList(o.numbers, o.country);
  if (valid.length === 0) return { added: 0, skipped: 0, invalid };
  const used = await prisma.phoneNumber.findMany({ where: { number: { in: valid } }, select: { number: true } });
  const usedSet = new Set(used.map((u) => u.number));
  const fresh = valid.filter((v) => !usedSet.has(v));
  const res = await prisma.numberStock.createMany({
    data: fresh.map((number) => ({
      number,
      country: o.country,
      network: o.network,
      kind: o.kind,
      monthlyPriceXof: o.monthlyPriceXof,
      setupPriceXof: o.setupPriceXof,
      note: o.note ?? null,
    })),
    skipDuplicates: true,
  });
  return { added: res.count, skipped: valid.length - res.count, invalid };
}

/** Met un numéro en pause ou le remet en vente (jamais un numéro réservé ou attribué). */
export async function setStockEnabled(id: string, enabled: boolean): Promise<boolean> {
  const res = await prisma.numberStock.updateMany({
    where: { id, status: enabled ? "disabled" : "available" },
    data: { status: enabled ? "available" : "disabled" },
  });
  return res.count === 1;
}

/** Libère un numéro réservé par une demande qui n'est plus en attente (reprise après incident). */
export async function releaseOrphanReservation(id: string): Promise<boolean> {
  const stock = await prisma.numberStock.findUnique({ where: { id }, select: { status: true, requestId: true } });
  if (!stock || stock.status !== "reserved") return false;
  const req = stock.requestId
    ? await prisma.numberRequest.findUnique({ where: { id: stock.requestId }, select: { status: true } })
    : null;
  if (req?.status === "pending") return false;
  const res = await prisma.numberStock.updateMany({
    where: { id, status: "reserved", requestId: stock.requestId },
    data: { status: "available", requestId: null },
  });
  return res.count === 1;
}

export async function deleteStock(id: string): Promise<boolean> {
  const res = await prisma.numberStock.deleteMany({ where: { id, status: { in: ["available", "disabled"] } } });
  return res.count === 1;
}

/**
 * Valide une demande : attribue le numéro réservé, ou celui choisi par
 * l'admin dans le stock, et le crée dans les numéros du client (actif).
 */
export async function approveNumberRequest(
  id: string,
  stockId: string | null,
  note: string | null,
): Promise<{ number: string; organizationId: string }> {
  const request = await prisma.numberRequest.findUnique({ where: { id } });
  if (!request || request.status !== "pending") throw new MarketError("Demande introuvable ou déjà traitée.");
  const chosen = stockId ?? request.stockId;
  if (!chosen) throw new MarketError("Choisissez un numéro du stock à attribuer.");

  const org = await prisma.organization.findUnique({ where: { id: request.organizationId }, select: { plan: true } });
  const plan = getPlan(org?.plan ?? "");
  const owned = await prisma.phoneNumber.count({ where: { organizationId: request.organizationId } });
  if (owned >= plan.maxNumbers) {
    throw new MarketError(`Le client a atteint la limite de son offre (${plan.maxNumbers} numéro(s)).`);
  }

  return prisma.$transaction(async (tx) => {
    // La demande passe d'abord à « approved » sous condition : une seule
    // attribution, jamais sur une demande annulée ou refusée entre-temps.
    const claimed = await tx.numberRequest.updateMany({
      where: { id: request.id, status: "pending" },
      data: { status: "approved", adminNote: note },
    });
    if (claimed.count !== 1) throw new MarketError("Demande déjà traitée.");
    const ownedNow = await tx.phoneNumber.count({ where: { organizationId: request.organizationId } });
    if (ownedNow >= plan.maxNumbers) {
      throw new MarketError(`Le client a atteint la limite de son offre (${plan.maxNumbers} numéro(s)).`);
    }
    const stock = await tx.numberStock.findUnique({ where: { id: chosen } });
    if (!stock) throw new MarketError("Numéro introuvable dans le stock.");
    if (stock.country !== request.country) throw new MarketError("Ce numéro n'est pas du pays demandé.");
    const taken = await tx.numberStock.updateMany({
      where: {
        id: chosen,
        OR: [{ status: "available" }, { status: "reserved", requestId: request.id }],
      },
      data: { status: "assigned", organizationId: request.organizationId, requestId: request.id },
    });
    if (taken.count !== 1) throw new MarketError("Ce numéro est déjà réservé ou attribué.");
    // Le numéro réservé au départ, s'il diffère de celui attribué, est libéré.
    await tx.numberStock.updateMany({
      where: { requestId: request.id, status: "reserved", id: { not: chosen } },
      data: { status: "available", requestId: null },
    });
    const exists = await tx.phoneNumber.findUnique({ where: { number: stock.number }, select: { id: true } });
    if (exists) throw new MarketError("Ce numéro est déjà enregistré chez un client.");
    await tx.phoneNumber.create({
      data: {
        organizationId: request.organizationId,
        number: stock.number,
        label: `${networkLabel(stock.country, stock.network)} · ${marketCountry(stock.country)?.label ?? stock.country}`,
        provider: "sip",
        monthlyPrice: xofToEur(stock.monthlyPriceXof),
        status: "active",
        purchased: true,
      },
    });
    await tx.numberRequest.update({
      where: { id: request.id },
      data: { stockId: chosen, assignedNumber: stock.number },
    });
    return { number: stock.number, organizationId: request.organizationId };
  });
}

export async function rejectNumberRequest(id: string, note: string | null): Promise<{ organizationId: string } | null> {
  const row = await prisma.numberRequest.findUnique({ where: { id }, select: { organizationId: true, status: true } });
  if (!row || row.status !== "pending") return null;
  return prisma.$transaction(async (tx) => {
    const done = await tx.numberRequest.updateMany({
      where: { id, status: "pending" },
      data: { status: "rejected", adminNote: note },
    });
    if (done.count !== 1) return null;
    await releaseReservation(tx, id);
    return { organizationId: row.organizationId };
  });
}

/** Le numéro est-il géré par la marketplace (en stock, quel que soit son état) ? */
export async function isStockNumber(number: string): Promise<boolean> {
  return (await prisma.numberStock.count({ where: { number } })) > 0;
}
