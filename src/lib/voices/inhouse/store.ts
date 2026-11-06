/**
 * Accès base des voix maison (serveur uniquement).
 * Les octets audio ne sont jamais chargés dans les listes : seulement à l'écoute.
 */
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { decodeMulaw } from "@/lib/voice-engine/audio";
import { callpmeSpeechBuffer } from "@/lib/voice-engine/callpme-tts";
import { pcm16ToWav } from "./audio-format";
import { modelRefForJob, type DatasetSummary } from "./rules";

const clipMeta = {
  id: true,
  transcript: true,
  mimeType: true,
  sizeBytes: true,
  durationMs: true,
  source: true,
  createdAt: true,
} as const;

export async function datasetSummary(voiceId: string): Promise<DatasetSummary> {
  const agg = await prisma.inhouseVoiceClip.aggregate({
    where: { voiceId },
    _count: { _all: true },
    _sum: { durationMs: true },
  });
  return { clips: agg._count._all, durationMs: agg._sum.durationMs ?? 0 };
}

export async function listInhouseVoices() {
  const voices = await prisma.inhouseVoice.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      consent: { select: { speakerName: true, revokedAt: true } },
      versions: { select: { status: true } },
      jobs: { select: { status: true }, orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  const sums = await prisma.inhouseVoiceClip.groupBy({
    by: ["voiceId"],
    _count: { _all: true },
    _sum: { durationMs: true },
  });
  return voices.map((v) => {
    const s = sums.find((x) => x.voiceId === v.id);
    return {
      id: v.id,
      name: v.name,
      speakerName: v.consent?.speakerName ?? null,
      consent: v.consent ? (v.consent.revokedAt ? "revoked" : "valid") : "missing",
      clips: s?._count._all ?? 0,
      durationMs: s?._sum.durationMs ?? 0,
      lastJob: v.jobs[0]?.status ?? null,
      published: v.versions.filter((x) => x.status === "published").length,
    } as const;
  });
}

export async function getInhouseVoice(id: string) {
  return prisma.inhouseVoice.findUnique({
    where: { id },
    include: {
      consent: { select: { id: true, speakerName: true, speakerContact: true, formVersion: true, signedAt: true, documentName: true, attestedAt: true, revokedAt: true, revokeReason: true } },
      clips: { select: clipMeta, orderBy: { createdAt: "desc" } },
      jobs: { orderBy: { createdAt: "desc" } },
      versions: { select: { id: true, number: true, modelRef: true, status: true, notes: true, platformVoiceId: true, publishedAt: true, createdAt: true, jobId: true }, orderBy: { number: "desc" } },
    },
  });
}

type Db = Prisma.TransactionClient | typeof prisma;

/**
 * Passe un entraînement à « réussi » ET crée sa version brouillon, dans une
 * seule transaction : jamais d'entraînement réussi sans version. Ne s'applique
 * que si l'état n'a pas changé depuis sa lecture (`from`). Renvoie false sinon.
 */
export async function completeTraining(jobId: string, from: string, message: string): Promise<boolean> {
  try {
    return await prisma.$transaction(async (tx) => {
      const moved = await tx.inhouseTrainingJob.updateMany({
        where: { id: jobId, status: from },
        data: { status: "succeeded", progress: 100, message, finishedAt: new Date() },
      });
      if (moved.count === 0) return false;
      await createDraftVersion(jobId, tx);
      return true;
    });
  } catch (e) {
    // Course entre le worker et la confirmation manuelle : l'autre a gagné.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return false;
    throw e;
  }
}

/** Crée la version brouillon produite par un entraînement réussi (idempotent). */
export async function createDraftVersion(jobId: string, db: Db = prisma) {
  const job = await db.inhouseTrainingJob.findUnique({ where: { id: jobId }, include: { version: true } });
  if (!job) throw new Error("Entraînement introuvable.");
  if (job.version) return job.version;
  const last = await db.inhouseVoiceVersion.aggregate({ where: { voiceId: job.voiceId }, _max: { number: true } });
  return db.inhouseVoiceVersion.create({
    data: {
      voiceId: job.voiceId,
      jobId: job.id,
      number: (last._max.number ?? 0) + 1,
      modelRef: modelRefForJob(job.id),
      notes: `Modèle de base : ${job.baseModel}`,
    },
  });
}

/** Synthétise `text` avec un modèle maison et renvoie un WAV (ce qu'entend l'appelant, 8 kHz). */
export async function synthesizeWav(modelRef: string, text: string, language = "fr"): Promise<Uint8Array> {
  const mulaw = await callpmeSpeechBuffer({ text, modelRef, language });
  return pcm16ToWav(decodeMulaw(mulaw), 8000);
}
