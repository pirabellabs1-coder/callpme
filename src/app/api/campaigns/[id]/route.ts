import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { setCampaignStatus, setCampaignSettings, deleteCampaign } from "@/lib/db/campaigns";
import {
  ok,
  badRequest,
  unauthorized,
  notFound,
  serverError,
} from "@/lib/api/respond";

export const dynamic = "force-dynamic";

const hm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const patchSchema = z
  .object({
    status: z.enum(["draft", "running", "paused", "completed"]).optional(),
    settings: z
      .object({
        timezone: z.string().max(60).refine((tz) => {
          try {
            new Intl.DateTimeFormat("en-US", { timeZone: tz });
            return true;
          } catch {
            return false;
          }
        }, "Fuseau inconnu"),
        days: z.array(z.number().int().min(0).max(6)).min(1, "Choisissez au moins un jour").max(7),
        windows: z
          .array(z.tuple([hm, hm]).refine(([a, b]) => a < b, "Plage horaire invalide"))
          .min(1)
          .max(3),
        maxConcurrent: z.number().int().min(1).max(20),
        maxAttempts: z.number().int().min(1).max(5),
        retryDelayMin: z.number().int().min(15).max(10080),
      })
      .optional(),
  })
  .refine((d) => d.status || d.settings, "Rien à modifier");

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();
    const body = await req.json().catch(() => null);
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? "Données invalides");
    if (parsed.data.settings) {
      const done = await setCampaignSettings(session.org.id, params.id, parsed.data.settings);
      if (!done) return notFound("Campagne introuvable");
    }
    if (parsed.data.status) {
      const okSet = await setCampaignStatus(session.org.id, params.id, parsed.data.status);
      if (!okSet) return notFound("Campagne introuvable");
    }
    return ok({ success: true });
  } catch {
    return serverError();
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();
    const removed = await deleteCampaign(session.org.id, params.id);
    return removed ? ok({ success: true }) : notFound("Campagne introuvable");
  } catch {
    return serverError();
  }
}
