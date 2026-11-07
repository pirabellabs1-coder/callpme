import { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/client";
import { getAdminSession } from "@/lib/auth/session";
import { badRequest, notFound, ok } from "@/lib/api/respond";
import { checkClip, CLIP_LIMITS, consentValid, MAX_CLIPS_PER_VOICE } from "@/lib/voices/inhouse/rules";
import { sniffAudio, wavInfo } from "@/lib/voices/inhouse/audio-format";
import { readFormFile, sameOrigin } from "@/lib/voices/inhouse/http";

export const dynamic = "force-dynamic";

/**
 * POST — ajoute un clip au jeu de données : fichier audio + transcription
 * exacte + attestation que c'est bien la voix du locuteur consentant.
 * Le format est vérifié sur les octets réels, pas sur le type annoncé.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAdminSession();
  if (!session) return notFound();
  if (!sameOrigin(req)) return badRequest("Origine refusée.");
  const voice = await prisma.inhouseVoice.findUnique({ where: { id: params.id }, include: { consent: { select: { revokedAt: true } } } });
  if (!voice) return notFound();
  if (!consentValid(voice.consent)) return badRequest("Consentement signé requis (absent ou révoqué) avant d'ajouter des clips.");

  if ((await prisma.inhouseVoiceClip.count({ where: { voiceId: voice.id } })) >= MAX_CLIPS_PER_VOICE) {
    return badRequest(`Plafond de ${MAX_CLIPS_PER_VOICE} clips atteint pour cette voix.`);
  }

  const form = await req.formData().catch(() => null);
  if (!form) return badRequest("Formulaire invalide.");
  const file = await readFormFile(form, "audio", CLIP_LIMITS.maxBytes);
  if ("error" in file) return badRequest(file.error);

  const checked = checkClip({
    attested: form.get("attest") === "on",
    transcript: String(form.get("transcript") ?? ""),
    mime: sniffAudio(file.bytes),
    wav: wavInfo(file.bytes),
  });
  if ("error" in checked) return badRequest(checked.error);

  const clip = await prisma.inhouseVoiceClip.create({
    data: {
      voiceId: voice.id,
      transcript: checked.transcript,
      audio: Buffer.from(file.bytes),
      mimeType: checked.mime,
      sizeBytes: file.bytes.byteLength,
      durationMs: checked.durationMs,
      source: form.get("source") === "record" ? "record" : "upload",
      consentAttested: true,
      uploadedById: session.user.id,
    },
    select: { id: true },
  });
  revalidatePath(`/admin/voix-maison/${voice.id}`);
  return ok({ ok: true, id: clip.id });
}
