import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/client";
import { forbidden, notFound, unauthorized } from "@/lib/api/respond";
import { consentValid, isActiveJob } from "@/lib/voices/inhouse/rules";
import { workerAuthorized } from "@/lib/voices/inhouse/worker";
import { binaryResponse } from "@/lib/voices/inhouse/http";

export const dynamic = "force-dynamic";

/** GET — audio d'un clip, pour le serveur GPU, seulement pendant un entraînement actif. */
export async function GET(req: NextRequest, { params }: { params: { jobId: string; clipId: string } }) {
  if (!workerAuthorized(req.headers.get("authorization"))) return unauthorized();
  const job = await prisma.inhouseTrainingJob.findUnique({
    where: { id: params.jobId },
    select: { status: true, voiceId: true, voice: { select: { consent: { select: { revokedAt: true } } } } },
  });
  if (!job) return notFound();
  if (!isActiveJob(job.status) || !consentValid(job.voice.consent)) return forbidden("Accès au jeu de données refusé.");
  const clip = await prisma.inhouseVoiceClip.findFirst({
    where: { id: params.clipId, voiceId: job.voiceId },
    select: { audio: true, mimeType: true },
  });
  if (!clip) return notFound();
  return binaryResponse(clip.audio, clip.mimeType);
}
