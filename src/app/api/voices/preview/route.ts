import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { synthesizeSpeech } from "@/lib/tts/providers";
import { ok, badRequest, unauthorized, serverError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

const schema = z.object({
  provider: z.enum(["elevenlabs", "cartesia", "openai"]),
  voiceId: z.string().min(1).max(120),
  text: z.string().min(1).max(600),
  language: z.string().max(10).optional(),
});

/**
 * POST /api/voices/preview — synthétise un extrait via le provider premium.
 * Renvoie { audio: dataUrl } si une clé est configurée, sinon { audio: null }
 * (le client se rabat alors sur la synthèse du navigateur).
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();
    const body = await req.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest("Données invalides");
    const result = await synthesizeSpeech(parsed.data);
    return ok({ audio: result?.dataUrl ?? null });
  } catch {
    return serverError();
  }
}
