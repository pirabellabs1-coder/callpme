import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession, isOrgAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { getPlan } from "@/lib/billing/plans";
import { hasPaidSubscription } from "@/lib/billing/status";
import { buyNumber, countryOfNumber, NumberError, releaseNumber } from "@/lib/telephony/numbers";
import { toE164 } from "@/lib/telephony/e164";
import { countSince, DAILY_LIMITS, takeDailyQuota } from "@/lib/security/daily-quota";
import { created, badRequest, forbidden, unauthorized, serverError, tooMany } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

const schema = z.object({
  phoneNumber: z.string().max(20),
  label: z.string().trim().max(80).optional(),
});

/** Achats cumulés autorisés sur 30 jours (numéros rendus compris : pas d'achat/rendu en boucle). */
const MONTHLY_PURCHASES_MARGIN = 3;

class LimitError extends Error {}

/**
 * POST /api/numbers/purchase — achète un numéro pour l'organisation (compte
 * opérateur de la plateforme) et le relie au moteur vocal.
 * Conditions : administrateur, abonnement payé, pays proposé, limite de l'offre.
 * La place est réservée en base AVANT l'achat (verrou par organisation), et
 * l'achat est annulé chez l'opérateur si l'enregistrement échoue.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();
    if (!isOrgAdmin(session)) return forbidden("Réservé aux administrateurs de l'organisation.");
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return badRequest("Numéro invalide.");
    const number = toE164(parsed.data.phoneNumber);
    const country = number ? countryOfNumber(number) : null;
    if (!number || !country) return badRequest("Ce numéro n'est pas proposé.");
    if (!(await hasPaidSubscription(session.org.id))) {
      return forbidden("L'achat de numéros nécessite un abonnement payé. Réglez votre offre dans « Facturation ».");
    }

    const orgId = session.org.id;
    const plan = getPlan(session.org.plan);
    if ((await countSince(orgId, "number", 30)) >= Math.min(plan.maxNumbers, 50) + MONTHLY_PURCHASES_MARGIN) {
      return tooMany("Trop d'achats de numéros ce mois-ci. Contactez-nous pour en ajouter.");
    }
    if (!(await takeDailyQuota(orgId, "number"))) {
      return tooMany(`Au plus ${DAILY_LIMITS.number} achats de numéros par jour.`);
    }

    // Réservation atomique : deux achats simultanés ne dépassent pas la limite.
    let reservation;
    try {
      reservation = await prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`numbers:${orgId}`}))`;
        const count = await tx.phoneNumber.count({ where: { organizationId: orgId } });
        if (count >= plan.maxNumbers) {
          throw new LimitError(`Limite de l'offre ${plan.name} atteinte (${plan.maxNumbers} numéros).`);
        }
        if (await tx.phoneNumber.findUnique({ where: { number } })) throw new LimitError("Ce numéro est déjà utilisé.");
        return tx.phoneNumber.create({
          data: {
            organizationId: orgId,
            number,
            label: parsed.data.label || `${country.label} · acheté via Callpme`,
            provider: "pending",
            purchased: true,
            status: "provisioning",
            monthlyPrice: country.monthlyEur,
          },
        });
      });
    } catch (e) {
      if (e instanceof LimitError) return forbidden(e.message);
      throw e;
    }

    let bought: { providerRef: string; provider: "twilio" | "telnyx" };
    try {
      bought = await buyNumber(number);
    } catch (e) {
      await prisma.phoneNumber.delete({ where: { id: reservation.id } }).catch(() => {});
      throw e;
    }
    try {
      const row = await prisma.phoneNumber.update({
        where: { id: reservation.id },
        data: { provider: bought.provider, providerRef: bought.providerRef, status: "active" },
      });
      return created({ number: { id: row.id, number: row.number, label: row.label, status: row.status } });
    } catch (e) {
      // Enregistrement impossible : le numéro est rendu pour ne pas rester payé sans titulaire.
      const released = await releaseNumber(bought.provider, bought.providerRef, number);
      console.error(`[numéros] enregistrement après achat impossible (${number}, ${bought.providerRef}) ; rendu : ${released}`, e);
      await prisma.phoneNumber.delete({ where: { id: reservation.id } }).catch(() => {});
      return serverError("Achat annulé : l'enregistrement a échoué. Réessayez.");
    }
  } catch (e) {
    if (e instanceof NumberError) return badRequest(e.message);
    console.error("[numéros] achat :", e instanceof Error ? e.message : e);
    return serverError("Achat impossible pour le moment.");
  }
}
