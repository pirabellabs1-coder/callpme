"use server";

import { revalidatePath } from "next/cache";
import { getSession, isOrgAdmin } from "@/lib/auth/session";
import { isRateLimited } from "@/lib/security/rate-limit";
import { cleanPrefix, numberRequestSchema } from "@/lib/numbers/market";
import {
  MarketError,
  cancelNumberRequest,
  createNumberRequest,
  searchStock,
  type StockOffer,
} from "@/lib/numbers/market-db";

export interface MarketResult {
  ok?: boolean;
  error?: string;
}

/** Catalogue : numéros disponibles selon les filtres du client. */
export async function searchNumberOffers(f: {
  country: string;
  network?: string;
  kind?: string;
  prefix?: string;
}): Promise<{ offers?: StockOffer[]; error?: string }> {
  const session = await getSession();
  if (!session) return { error: "Session expirée : reconnectez-vous." };
  if (isRateLimited(`numsearch:${session.org.id}`, 120, 60 * 60_000)) {
    return { error: "Trop de recherches en peu de temps. Réessayez dans quelques minutes." };
  }
  const offers = await searchStock({
    country: String(f.country ?? "").slice(0, 2),
    network: f.network ? String(f.network).slice(0, 20) : undefined,
    kind: f.kind === "mobile" || f.kind === "fixe" ? f.kind : undefined,
    prefix: cleanPrefix(f.prefix),
  });
  return { offers };
}

/** Demande d'un numéro (du stock, ou libre si rien n'est disponible). */
export async function requestNumber(input: unknown): Promise<MarketResult> {
  const session = await getSession();
  if (!session) return { error: "Session expirée : reconnectez-vous." };
  if (!isOrgAdmin(session)) return { error: "Seuls les administrateurs de l'organisation peuvent demander un numéro." };
  if (isRateLimited(`numreq:${session.org.id}`, 6, 60 * 60_000)) {
    return { error: "Trop de demandes en peu de temps. Réessayez plus tard." };
  }
  const parsed = numberRequestSchema.safeParse(input);
  if (!parsed.success) return { error: "Vérifiez les informations du formulaire : certains champs sont manquants ou invalides." };
  try {
    await createNumberRequest({ id: session.org.id, plan: session.org.plan }, session.user.id, parsed.data);
  } catch (e) {
    if (e instanceof MarketError) return { error: e.message };
    console.error("[numéros] demande impossible", e);
    return { error: "La demande n'a pas pu être enregistrée. Réessayez." };
  }
  revalidatePath("/numbers");
  revalidatePath("/numbers/acheter");
  return { ok: true };
}

export async function cancelMyNumberRequest(id: string): Promise<MarketResult> {
  const session = await getSession();
  if (!session) return { error: "Session expirée : reconnectez-vous." };
  if (!isOrgAdmin(session)) return { error: "Réservé aux administrateurs de l'organisation." };
  const done = await cancelNumberRequest(session.org.id, String(id).slice(0, 40));
  if (!done) return { error: "Demande introuvable ou déjà traitée." };
  revalidatePath("/numbers");
  revalidatePath("/numbers/acheter");
  return { ok: true };
}
