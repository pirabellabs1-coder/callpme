import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { synthesizeSpeech } from "@/lib/tts/providers";
import { loadStudioExtras } from "@/lib/voices/studio";
import { pronunciationsSchema, tuningSchema } from "@/lib/voices/tuning";
import { isRateLimited } from "@/lib/security/rate-limit";
import { ok, badRequest, unauthorized, serverError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

const schema = z.object({
  provider: z.enum(["elevenlabs", "cartesia", "openai"]),
  voiceId: z.string().min(1).max(120),
  text: z.string().min(1).max(600),
  language: z.string().max(10).optional(),
  /** Langue locale en mode bilingue : la voix n'est pas forcée dans la langue. */
  bilingual: z.boolean().optional(),
  /** Réglages en cours d'édition dans le Studio. */
  tuning: tuningSchema.optional(),
  pronunciations: pronunciationsSchema.optional(),
  /** Voix Studio enregistrée : ses réglages sont relus côté serveur. */
  studioVoiceId: z.string().max(40).optional(),
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
    // Chaque écoute consomme des caractères ElevenLabs.
    if (isRateLimited(`preview:${session.user.id}`, 40, 10 * 60_000)) {
      return badRequest("Trop d'écoutes en peu de temps. Patientez quelques minutes.");
    }
    const body = await req.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest("Données invalides");
    const { studioVoiceId, ...input } = parsed.data;
    const studio = studioVoiceId ? await loadStudioExtras(session.org.id, studioVoiceId) : null;
    const result = await synthesizeSpeech({
      ...input,
      ...(studio?.voiceId ? { voiceId: studio.voiceId } : {}),
      tuning: input.tuning ?? studio?.tuning,
      pronunciations: input.pronunciations ?? studio?.pronunciations,
    });
    return ok({ audio: result?.dataUrl ?? null });
  } catch {
    return serverError();
  }
}
