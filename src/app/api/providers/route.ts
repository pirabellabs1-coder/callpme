import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { createProvider } from "@/lib/db/numbers";
import {
  created,
  badRequest,
  unauthorized,
  serverError,
} from "@/lib/api/respond";

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
    const body = await req.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return badRequest("Données invalides", parsed.error.flatten());
    }
    const provider = await createProvider(session.org.id, parsed.data);
    return created({ provider });
  } catch {
    return serverError("Impossible de connecter l'opérateur");
  }
}
