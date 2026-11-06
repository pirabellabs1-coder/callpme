import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { getAdminSession } from "@/lib/auth/session";
import { badRequest, notFound } from "@/lib/api/respond";
import { isRateLimited } from "@/lib/security/rate-limit";
import { callpmeTtsConfigured } from "@/lib/voice-engine/callpme-tts";
import { synthesizeWav } from "@/lib/voices/inhouse/store";
import { binaryResponse, sameOrigin } from "@/lib/voices/inhouse/http";

export const dynamic = "force-dynamic";

const schema = z.object({ text: z.string().trim().min(1).max(400) });

/** POST — fait parler une version (brouillon ou publiée) : WAV 8 kHz, comme au téléphone. */
export async function POST(req: NextRequest, { params }: { params: { versionId: string } }) {
  const session = await getAdminSession();
  if (!session) return notFound();
  if (!sameOrigin(req)) return badRequest("Origine refusée.");
  if (!callpmeTtsConfigured()) return badRequest("Serveur d'inférence non configuré (CALLPME_TTS_URL).");
  if (isRateLimited(`inhouse-preview:${session.user.id}`, 60, 10 * 60_000)) return badRequest("Trop d'écoutes, patientez.");
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest("Texte de 1 à 400 caractères requis.");
  const version = await prisma.inhouseVoiceVersion.findUnique({
    where: { id: params.versionId },
    select: { modelRef: true, voice: { select: { language: true } } },
  });
  if (!version) return notFound();
  try {
    return binaryResponse(await synthesizeWav(version.modelRef, parsed.data.text, version.voice.language), "audio/wav");
  } catch (e) {
    return badRequest(e instanceof Error ? e.message : "Synthèse impossible.");
  }
}
