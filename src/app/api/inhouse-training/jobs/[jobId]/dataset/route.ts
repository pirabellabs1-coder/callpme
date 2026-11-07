import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/client";
import { forbidden, notFound, ok, unauthorized } from "@/lib/api/respond";
import { consentValid, isActiveJob, modelRefForJob } from "@/lib/voices/inhouse/rules";
import { publicBaseUrl, workerAuthorized } from "@/lib/voices/inhouse/worker";

export const dynamic = "force-dynamic";

/**
 * GET — manifeste du jeu de données d'un entraînement, pour le serveur GPU
 * (Authorization: Bearer CALLPME_TRAINING_SECRET). Refusé si le consentement
 * est révoqué ou si l'entraînement n'est plus actif.
 */
export async function GET(req: NextRequest, { params }: { params: { jobId: string } }) {
  if (!workerAuthorized(req.headers.get("authorization"))) return unauthorized();
  const job = await prisma.inhouseTrainingJob.findUnique({
    where: { id: params.jobId },
    include: { voice: { include: { consent: { select: { revokedAt: true, formVersion: true } } } } },
  });
  if (!job) return notFound();
  if (!isActiveJob(job.status)) return forbidden("Entraînement terminé ou annulé.");
  if (!consentValid(job.voice.consent)) return forbidden("Consentement révoqué.");
  const clips = await prisma.inhouseVoiceClip.findMany({
    where: { voiceId: job.voiceId },
    select: { id: true, transcript: true, mimeType: true, durationMs: true },
    orderBy: { createdAt: "asc" },
  });
  return ok({
    jobId: job.id,
    modelRef: modelRefForJob(job.id),
    baseModel: job.baseModel,
    language: job.voice.language,
    consentFormVersion: job.voice.consent?.formVersion,
    clips: clips.map((c) => ({
      ...c,
      url: `${publicBaseUrl()}/api/inhouse-training/jobs/${job.id}/clips/${c.id}`,
    })),
  });
}
