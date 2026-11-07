import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession, isOrgAdmin } from "@/lib/auth/session";
import { createProvider } from "@/lib/db/numbers";
import { prisma } from "@/lib/db/client";
import { isRateLimited } from "@/lib/security/rate-limit";
import { accountKey, checkTwilioCredentials } from "@/lib/telephony/twilio-accounts";
import {
  created,
  badRequest,
  unauthorized,
  serverError, forbidden } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

const schema = z.object({
  provider: z.enum(["twilio", "zadarma", "vonage", "ovh", "telnyx"]),
  label: z.string().min(1).max(80),
  accountSid: z.string().max(200).optional(),
  authToken: z.string().max(200).optional(),
  apiKey: z.string().max(200).optional(),
  apiSecret: z.string().max(200).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();
    if (!isOrgAdmin(session)) return forbidden("Réservé aux administrateurs de l'organisation.");
    const body = await req.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return badRequest("Données invalides", parsed.error.flatten());
    }
    // Twilio : identifiants vérifiés auprès de Twilio avant d'être enregistrés (chiffrés).
    let key: string | undefined;
    if (parsed.data.provider === "twilio") {
      if (isRateLimited(`twiliocheck:${session.org.id}`, 10, 60 * 60_000)) {
        return badRequest("Trop de tentatives de connexion. Réessayez dans une heure.");
      }
      const sid = (parsed.data.accountSid ?? "").trim();
      const token = (parsed.data.authToken ?? "").trim();
      const check = await checkTwilioCredentials(sid, token);
      if (!check.ok) return badRequest(check.error);
      key = accountKey(sid);
      const dup = await prisma.providerConnection.findFirst({
        where: { provider: "twilio", accountKey: key },
        select: { organizationId: true },
      });
      if (dup) {
        return badRequest(
          dup.organizationId === session.org.id
            ? "Ce compte Twilio est déjà connecté."
            : "Ce compte Twilio est déjà connecté à une autre organisation Callpme.",
        );
      }
      parsed.data.accountSid = sid;
      parsed.data.authToken = token;
    }
    const provider = await createProvider(session.org.id, { ...parsed.data, accountKey: key });
    return created({ provider });
  } catch {
    return serverError("Impossible de connecter l'opérateur");
  }
}
