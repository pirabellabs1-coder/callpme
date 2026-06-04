import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { createVoice } from "@/lib/db/voices";
import { created, badRequest, unauthorized, serverError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string().min(1).max(60),
  provider: z
    .enum(["custom", "elevenlabs", "cartesia", "openai", "azure", "playht"])
    .optional(),
  gender: z.enum(["feminine", "masculine", "neutral"]).optional(),
  accent: z.string().max(40).optional(),
  description: z.string().max(300).optional(),
  sampleText: z.string().max(500).optional(),
  settings: z.string().max(2000).optional(),
  sampleUrl: z.string().max(6_000_000).optional(), // data URL d'un échantillon court
});

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();
    const body = await req.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest("Données invalides");
    const voice = await createVoice(session.org.id, parsed.data);
    return created({ voice });
  } catch {
    return serverError();
  }
}
