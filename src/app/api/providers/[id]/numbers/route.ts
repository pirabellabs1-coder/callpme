import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession, isOrgAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { getPlan } from "@/lib/billing/plans";
import { isRateLimited } from "@/lib/security/rate-limit";
import { toE164 } from "@/lib/telephony/e164";
import {
  TwilioAccountError,
  connectionCreds,
  linkTwilioNumber,
  listTwilioNumbers,
} from "@/lib/telephony/twilio-accounts";
import { badRequest, created, forbidden, notFound, ok, serverError, unauthorized } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

async function context(id: string) {
  const session = await getSession();
  if (!session) return { error: unauthorized() } as const;
  if (!isOrgAdmin(session)) return { error: forbidden("Réservé aux administrateurs de l'organisation.") } as const;
  const conn = await prisma.providerConnection.findFirst({
    where: { id, organizationId: session.org.id },
    select: { id: true, provider: true },
  });
  if (!conn) return { error: notFound("Opérateur introuvable") } as const;
  if (conn.provider !== "twilio") {
    return { error: badRequest("L'import automatique des numéros est disponible pour Twilio.") } as const;
  }
  const creds = await connectionCreds(conn.id, session.org.id);
  if (!creds) return { error: badRequest("Identifiants Twilio illisibles : reconnectez le compte.") } as const;
  return { session, creds } as const;
}

/** GET /api/providers/:id/numbers — numéros du compte Twilio du client. */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ctx = await context(params.id);
    if ("error" in ctx) return ctx.error;
    if (isRateLimited(`twiliolist:${ctx.session.org.id}`, 30, 60 * 60_000)) return badRequest("Trop de requêtes. Réessayez plus tard.");
    const numbers = await listTwilioNumbers(ctx.creds);
    const known = await prisma.phoneNumber.findMany({
      where: { number: { in: numbers.map((n) => n.phoneNumber) } },
      select: { number: true, organizationId: true, connectionId: true },
    });
    return ok({
      numbers: numbers.map((n) => {
        const k = known.find((x) => x.number === n.phoneNumber);
        return {
          sid: n.sid,
          phoneNumber: n.phoneNumber,
          friendlyName: n.friendlyName,
          voice: n.voice,
          linked: n.linked,
          imported: Boolean(k && k.organizationId === ctx.session.org.id && k.connectionId === ctx.creds.connectionId),
          usedElsewhere: Boolean(k && k.organizationId !== ctx.session.org.id),
        };
      }),
    });
  } catch (e) {
    if (e instanceof TwilioAccountError) return badRequest(e.message);
    return serverError("Impossible de lire les numéros Twilio.");
  }
}

const schema = z.object({
  numberSid: z.string().regex(/^PN[0-9a-fA-F]{32}$/),
  label: z.string().trim().max(80).optional(),
});

/**
 * POST /api/providers/:id/numbers — importe un numéro du compte Twilio du
 * client : il est configuré vers Callpme chez Twilio, puis actif dans Callpme.
 * La propriété est prouvée par l'API Twilio (le numéro est sur SON compte).
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const ctx = await context(params.id);
    if ("error" in ctx) return ctx.error;
    const { session, creds } = ctx;
    if (isRateLimited(`twilioimport:${session.org.id}`, 20, 60 * 60_000)) return badRequest("Trop d'imports. Réessayez plus tard.");
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return badRequest("Numéro Twilio invalide.");

    const owned = (await listTwilioNumbers(creds)).find((n) => n.sid === parsed.data.numberSid);
    if (!owned) return badRequest("Ce numéro n'est pas sur votre compte Twilio.");
    if (!owned.voice) return badRequest("Ce numéro ne permet pas les appels vocaux.");
    const number = toE164(owned.phoneNumber);
    if (!number) return badRequest("Numéro invalide.");

    let existing = await prisma.phoneNumber.findUnique({ where: { number } });
    if (existing && existing.organizationId !== session.org.id) {
      // Simple déclaration manuelle jamais vérifiée : le titulaire prouvé par Twilio la remplace.
      const unverified = existing.status === "pending" && !existing.connectionId && !existing.purchased;
      if (!unverified) return badRequest("Ce numéro est déjà utilisé par une autre organisation.");
      await prisma.$transaction([
        prisma.agent.updateMany({ where: { organizationId: existing.organizationId, phoneNumber: number }, data: { phoneNumber: null } }),
        prisma.phoneNumber.delete({ where: { id: existing.id } }),
      ]);
      existing = null;
    }
    if (!existing) {
      const plan = getPlan(session.org.plan);
      const count = await prisma.phoneNumber.count({ where: { organizationId: session.org.id } });
      if (count >= plan.maxNumbers) {
        return forbidden(`Limite de l'offre ${plan.name} atteinte (${plan.maxNumbers} numéros). Passez à une offre supérieure.`);
      }
    }

    // Configuration chez Twilio d'abord : sans elle, le numéro ne recevrait aucun appel.
    await linkTwilioNumber(creds, owned.sid);

    const data = {
      label: parsed.data.label || owned.friendlyName || "Numéro Twilio",
      provider: "twilio",
      status: "active",
      connectionId: creds.connectionId,
      providerRef: owned.sid,
      purchased: false,
    };
    const row = existing
      ? await prisma.phoneNumber.update({ where: { number }, data })
      : await prisma.phoneNumber.create({ data: { ...data, organizationId: session.org.id, number, monthlyPrice: 0 } });
    return created({ number: { id: row.id, number: row.number, label: row.label, status: row.status } });
  } catch (e) {
    if (e instanceof TwilioAccountError) return badRequest(e.message);
    return serverError("Import du numéro impossible.");
  }
}
