import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { createPhoneNumber } from "@/lib/db/numbers";
import { getPlan } from "@/lib/billing/plans";
import {
  created,
  badRequest,
  forbidden,
  unauthorized,
  serverError,
} from "@/lib/api/respond";

export const dynamic = "force-dynamic";

const schema = z.object({
  number: z.string().min(4).max(40),
  label: z.string().min(1).max(80),
  provider: z.enum(["twilio", "zadarma", "vonage", "ovh", "telnyx", "manual"]),
  monthlyPrice: z.number().min(0).max(1000).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();
    const body = await req.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return badRequest("Données invalides", parsed.error.flatten());
    }
    const plan = getPlan(session.org.plan);
    const count = await prisma.phoneNumber.count({
      where: { organizationId: session.org.id },
    });
    if (count >= plan.maxNumbers) {
      return forbidden(
        `Limite de l'offre ${plan.name} atteinte (${plan.maxNumbers} numéros). Passez à une offre supérieure.`,
      );
    }
    const existing = await prisma.phoneNumber.findUnique({
      where: { number: parsed.data.number },
    });
    if (existing) return badRequest("Ce numéro est déjà enregistré.");

    const number = await createPhoneNumber(session.org.id, parsed.data);
    return created({ number });
  } catch {
    return serverError("Impossible d'ajouter le numéro");
  }
}
