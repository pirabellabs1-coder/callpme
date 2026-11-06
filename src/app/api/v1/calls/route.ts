import { NextRequest } from "next/server";
import { orgCountry } from "@/lib/geo/org-country";
import { authenticateApiKey } from "@/lib/auth/api-key";
import { listCalls } from "@/lib/db/calls";
import { ok, unauthorized, badRequest, forbidden, notFound, serverError } from "@/lib/api/respond";
import { z } from "zod";
import { getAgentById } from "@/lib/db/agents";
import { placeOutboundCall, telephonyConfigured } from "@/lib/telephony/provider";
import { checkDestination } from "@/lib/telephony/destinations";
import { canCallOut } from "@/lib/billing/limits";
import { isOptedOut } from "@/lib/campaigns/engine";
import { takeDailyQuota } from "@/lib/security/daily-quota";
import { toE164 } from "@/lib/telephony/e164";
import type { CallDirection, CallStatus } from "@/lib/shared/types";

export const dynamic = "force-dynamic";

const STATUSES: CallStatus[] = [
  "completed",
  "transferred",
  "failed",
  "missed",
  "in_progress",
];
const DIRECTIONS: CallDirection[] = ["inbound", "outbound"];

/** GET /api/v1/calls — liste les appels (auth par clé API). */
export async function GET(req: NextRequest) {
  const org = await authenticateApiKey(req);
  if (!org) return unauthorized("Clé API invalide ou manquante");

  const sp = req.nextUrl.searchParams;
  const status = sp.get("status");
  const direction = sp.get("direction");
  const limit = sp.get("limit");

  const calls = await listCalls(org.id, {
    agentId: sp.get("agentId") || undefined,
    status:
      status && STATUSES.includes(status as CallStatus)
        ? (status as CallStatus)
        : undefined,
    direction:
      direction && DIRECTIONS.includes(direction as CallDirection)
        ? (direction as CallDirection)
        : undefined,
    limit: limit ? Math.min(Number(limit) || 100, 500) : undefined,
  });
  return ok({ data: calls });
}

const createSchema = z.object({
  agentId: z.string().min(5).max(60),
  to: z.string().min(5).max(25),
  /** Variables de la personne appelée ({nom}, {produit}…), utilisables dans le message d'accueil. */
  variables: z
    .record(z.string().regex(/^[a-z0-9_]{1,40}$/i), z.union([z.string().max(200), z.number()]))
    .optional()
    .refine((v) => !v || Object.keys(v).length <= 10, "10 variables au maximum"),
});

/**
 * POST /api/v1/calls — lance un appel sortant de l'agent vers un numéro
 * (rappel d'un prospect, relance, confirmation…). Auth par clé API.
 * Même règles que les campagnes : destination autorisée, liste
 * d'opposition, minutes de l'offre, plafond quotidien.
 */
export async function POST(req: NextRequest) {
  try {
    const org = await authenticateApiKey(req);
    if (!org) return unauthorized("Clé API invalide ou manquante");
    const parsed = createSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const msg =
        issue?.path[0] === "variables"
          ? "Variables invalides : 10 au plus, noms en lettres, chiffres ou _, valeurs de 200 caractères au plus."
          : issue?.path[0] === "to"
            ? "Numéro invalide (format international attendu, ex. +22901970000)."
            : issue?.path[0] === "agentId"
              ? "agentId manquant ou invalide."
              : "Requête invalide.";
      return badRequest(msg, parsed.error.flatten());
    }
    const { agentId, variables } = parsed.data;

    const agent = await getAgentById(agentId);
    if (!agent || agent.organizationId !== org.id) return notFound("Agent introuvable");
    if (agent.status !== "active") return badRequest("L'agent doit être « En ligne » pour passer des appels.");
    if (!telephonyConfigured()) return forbidden("Les appels sortants ne sont pas encore activés sur la plateforme.");

    const to = toE164(parsed.data.to, await orgCountry(org.id));
    if (!to) return badRequest("Numéro invalide (format international attendu, ex. +22901970000).");
    const dest = checkDestination(to);
    if (!dest.ok) return badRequest(dest.reason ?? "Destination non autorisée");
    if (await isOptedOut(org.id, to)) return forbidden("Ce numéro a demandé à ne plus être appelé (liste d'opposition).");
    const quota = await canCallOut(org.id);
    if (!quota.ok) return forbidden(quota.message);
    if (!(await takeDailyQuota(org.id, "apicall"))) return forbidden("Plafond quotidien d'appels par API atteint. Réessayez demain.");

    const result = await placeOutboundCall({
      agent,
      toNumber: to,
      metadata: variables ? { vars: JSON.stringify(variables), source: "api" } : { source: "api" },
    });
    if (!result.ok) return badRequest(result.error ?? "Appel impossible");
    return ok({ data: { callId: result.callId, status: result.status, to } }, { status: 202 });
  } catch {
    return serverError("Appel impossible");
  }
}
