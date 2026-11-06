import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession, isOrgAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { getPlan } from "@/lib/billing/plans";
import { buyNumber, NUMBER_COUNTRIES, NumberError } from "@/lib/telephony/numbers";
import { checkDestination } from "@/lib/telephony/destinations";
import { toE164 } from "@/lib/telephony/e164";
import { isRateLimited } from "@/lib/security/rate-limit";
import { created, badRequest, forbidden, unauthorized, serverError, tooMany } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

const schema = z.object({
  phoneNumber: z.string().max(20),
  label: z.string().trim().max(80).optional(),
});

/** Indicatif -> pays proposé (pour le prix et le contrôle). */
const DIAL: Record<string, string> = { "33": "FR", "32": "BE", "41": "CH", "1": "US", "225": "CI", "221": "SN" };

/**
 * POST /api/numbers/purchase — achète un numéro pour l'organisation (compte
 * opérateur de la plateforme) et le relie au moteur vocal. Réservé aux
 * administrateurs ; limité par l'offre.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();
    if (!isOrgAdmin(session)) return forbidden("Réservé aux administrateurs de l'organisation.");
    if (isRateLimited(`numbuy:${session.org.id}`, 5, 10 * 60_000)) return tooMany("Trop d'achats en peu de temps.");
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return badRequest("Numéro invalide.");
    const number = toE164(parsed.data.phoneNumber);
    if (!number || !checkDestination(number).ok) return badRequest("Ce numéro n'est pas proposé.");

    const plan = getPlan(session.org.plan);
    const [count, exists] = await Promise.all([
      prisma.phoneNumber.count({ where: { organizationId: session.org.id } }),
      prisma.phoneNumber.findUnique({ where: { number } }),
    ]);
    if (count >= plan.maxNumbers) {
      return forbidden(`Limite de l'offre ${plan.name} atteinte (${plan.maxNumbers} numéros). Passez à une offre supérieure.`);
    }
    if (exists) return badRequest("Ce numéro est déjà utilisé.");

    const prefix = Object.keys(DIAL).find((d) => number.startsWith(`+${d}`)) ?? "";
    const country = NUMBER_COUNTRIES.find((c) => c.code === (prefix === "1" ? "US" : DIAL[prefix]));
    const { providerRef, provider } = await buyNumber(number);
    const row = await prisma.phoneNumber.create({
      data: {
        organizationId: session.org.id,
        number,
        label: parsed.data.label || `${country?.label ?? "Numéro"} · acheté via Callpme`,
        provider,
        providerRef,
        purchased: true,
        status: "active",
        monthlyPrice: country?.monthlyEur ?? 0,
      },
    });
    return created({ number: { id: row.id, number: row.number, label: row.label, status: row.status } });
  } catch (e) {
    if (e instanceof NumberError) return badRequest(e.message);
    console.error("[numéros] achat :", e instanceof Error ? e.message : e);
    return serverError("Achat impossible pour le moment.");
  }
}
