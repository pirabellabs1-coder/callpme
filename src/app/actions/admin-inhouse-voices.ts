"use server";

/**
 * Actions super-admin des voix maison (voir docs/voix-maison.md).
 * Les envois de fichiers (clips, consentement) passent par des Route Handlers
 * dédiés : les Server Actions sont limitées à 1 Mo.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { requireAdmin } from "@/lib/auth/session";
import { callpmeTtsConfigured } from "@/lib/voice-engine/callpme-tts";
import { createDraftVersion, datasetSummary, hasActiveJob, synthesizeWav } from "@/lib/voices/inhouse/store";
import { canTransition, consentValid, isBaseModel, isActiveJob, modelRefForJob, SAMPLE_TEXT, trainingBlocker } from "@/lib/voices/inhouse/rules";
import { submitTrainingJob, trainingConfigured } from "@/lib/voices/inhouse/worker";

export interface InhouseActionResult {
  ok?: boolean;
  error?: string;
  id?: string;
}

const message = (e: unknown) => (e instanceof Error ? e.message : "Erreur inattendue.");

function refresh(voiceId?: string) {
  revalidatePath("/admin/voix-maison");
  if (voiceId) revalidatePath(`/admin/voix-maison/${voiceId}`);
  revalidatePath("/admin/voices");
}

const voiceSchema = z.object({
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(300).optional().transform((v) => v || null),
  gender: z.enum(["feminine", "masculine", "neutral"]).nullable().optional(),
  accent: z.string().trim().max(60).optional().transform((v) => v || null),
});

/** Crée une voix maison (vide : consentement et clips viennent ensuite). */
export async function createInhouseVoice(input: z.input<typeof voiceSchema>): Promise<InhouseActionResult> {
  const session = await requireAdmin();
  const parsed = voiceSchema.safeParse(input);
  if (!parsed.success) return { error: "Nom de 2 à 60 caractères requis." };
  const v = await prisma.inhouseVoice.create({
    data: { ...parsed.data, gender: parsed.data.gender ?? null, createdById: session.user.id },
  });
  refresh();
  return { ok: true, id: v.id };
}

/**
 * Révoque le consentement : plus aucun clip ni entraînement, entraînements en
 * cours annulés, versions publiées retirées du catalogue. Les clips restent
 * stockés jusqu'à leur suppression (preuve), mais ne servent plus.
 */
export async function revokeInhouseConsent(voiceId: string, reason: string): Promise<InhouseActionResult> {
  await requireAdmin();
  const why = reason.trim().slice(0, 300);
  if (why.length < 3) return { error: "Indiquez le motif de la révocation." };
  const consent = await prisma.inhouseVoiceConsent.findUnique({ where: { voiceId } });
  if (!consent) return { error: "Aucun consentement enregistré." };
  if (consent.revokedAt) return { ok: true };
  const published = await prisma.inhouseVoiceVersion.findMany({ where: { voiceId, status: "published" }, select: { platformVoiceId: true } });
  const ids = published.map((p) => p.platformVoiceId).filter((x): x is string => Boolean(x));
  await prisma.$transaction([
    prisma.inhouseVoiceConsent.update({ where: { voiceId }, data: { revokedAt: new Date(), revokeReason: why } }),
    prisma.inhouseTrainingJob.updateMany({
      where: { voiceId, status: { in: ["queued", "submitted", "running"] } },
      data: { status: "canceled", message: "Annulé : consentement révoqué.", finishedAt: new Date() },
    }),
    prisma.inhouseVoiceVersion.updateMany({ where: { voiceId, status: "published" }, data: { status: "retired" } }),
    prisma.platformVoice.updateMany({ where: { id: { in: ids } }, data: { active: false } }),
  ]);
  refresh(voiceId);
  return { ok: true };
}

/** Supprime définitivement un clip du jeu de données. */
export async function deleteInhouseClip(clipId: string): Promise<InhouseActionResult> {
  await requireAdmin();
  const clip = await prisma.inhouseVoiceClip.findUnique({ where: { id: clipId }, select: { voiceId: true } });
  if (!clip) return { ok: true };
  await prisma.inhouseVoiceClip.delete({ where: { id: clipId } });
  refresh(clip.voiceId);
  return { ok: true };
}

/**
 * Lance un entraînement. Sans serveur d'entraînement configuré, il reste en
 * file d'attente avec un message explicite (rien n'est simulé).
 */
export async function startInhouseTraining(voiceId: string, baseModel: string): Promise<InhouseActionResult> {
  const session = await requireAdmin();
  if (!isBaseModel(baseModel)) return { error: "Modèle de base inconnu." };
  const voice = await prisma.inhouseVoice.findUnique({ where: { id: voiceId }, include: { consent: { select: { revokedAt: true } } } });
  if (!voice) return { error: "Voix introuvable." };
  const dataset = await datasetSummary(voiceId);
  const blocker = trainingBlocker({ consent: voice.consent, dataset, hasActiveJob: await hasActiveJob(voiceId) });
  if (blocker) return { error: blocker };

  const job = await prisma.inhouseTrainingJob.create({
    data: {
      voiceId,
      baseModel,
      clipCount: dataset.clips,
      totalDurationMs: dataset.durationMs,
      createdById: session.user.id,
      message: trainingConfigured()
        ? "Envoi au serveur d'entraînement…"
        : "En attente : aucun serveur d'entraînement GPU n'est configuré (CALLPME_TRAINING_URL).",
    },
  });

  if (trainingConfigured()) {
    const base = (process.env.PUBLIC_URL || "http://localhost:3000").replace(/\/+$/, "");
    try {
      const { externalJobId } = await submitTrainingJob({
        jobId: job.id,
        modelRef: modelRefForJob(job.id),
        baseModel,
        language: voice.language,
        datasetUrl: `${base}/api/inhouse-training/jobs/${job.id}/dataset`,
        statusUrl: `${base}/api/inhouse-training/jobs/${job.id}/status`,
      });
      await prisma.inhouseTrainingJob.update({
        where: { id: job.id },
        data: { status: "submitted", externalJobId, message: "Reçu par le serveur d'entraînement.", startedAt: new Date() },
      });
    } catch (e) {
      await prisma.inhouseTrainingJob.update({
        where: { id: job.id },
        data: { status: "failed", message: message(e), finishedAt: new Date() },
      });
    }
  }
  refresh(voiceId);
  return { ok: true, id: job.id };
}

/** Annule un entraînement non terminé (côté Callpme ; le worker est prévenu à son prochain rapport). */
export async function cancelInhouseTraining(jobId: string): Promise<InhouseActionResult> {
  await requireAdmin();
  const job = await prisma.inhouseTrainingJob.findUnique({ where: { id: jobId } });
  if (!job) return { error: "Entraînement introuvable." };
  if (!canTransition(job.status, "canceled")) return { error: "Cet entraînement est déjà terminé." };
  await prisma.inhouseTrainingJob.update({
    where: { id: jobId },
    data: { status: "canceled", message: "Annulé par l'administrateur.", finishedAt: new Date() },
  });
  refresh(job.voiceId);
  return { ok: true };
}

/**
 * Mode manuel (tant que le worker n'est pas automatisé) : l'équipe a entraîné
 * le modèle à la main et l'a déployé sur le serveur d'inférence sous l'identifiant
 * `cpm_<jobId>`. On le vérifie en le faisant parler avant de créer la version.
 */
export async function confirmInhouseTrainingDone(jobId: string): Promise<InhouseActionResult> {
  await requireAdmin();
  const job = await prisma.inhouseTrainingJob.findUnique({ where: { id: jobId }, include: { voice: { include: { consent: true } } } });
  if (!job) return { error: "Entraînement introuvable." };
  if (!isActiveJob(job.status)) return { error: "Seul un entraînement en cours peut être confirmé." };
  if (!consentValid(job.voice.consent)) return { error: "Consentement absent ou révoqué." };
  if (!callpmeTtsConfigured()) return { error: "Serveur d'inférence non configuré (CALLPME_TTS_URL) : impossible de vérifier le modèle." };
  try {
    await synthesizeWav(modelRefForJob(job.id), "Test.", job.voice.language);
  } catch (e) {
    return { error: `Le modèle ${modelRefForJob(job.id)} ne répond pas : ${message(e)}` };
  }
  await prisma.inhouseTrainingJob.update({
    where: { id: jobId },
    data: { status: "succeeded", progress: 100, message: "Confirmé manuellement : modèle disponible.", finishedAt: new Date() },
  });
  await createDraftVersion(jobId);
  refresh(job.voiceId);
  return { ok: true };
}

/**
 * Publie une version au catalogue des clients. Exige un consentement valide et
 * un serveur d'inférence qui répond : l'échantillon public est généré ici.
 */
export async function publishInhouseVersion(versionId: string): Promise<InhouseActionResult> {
  await requireAdmin();
  const version = await prisma.inhouseVoiceVersion.findUnique({ where: { id: versionId }, include: { voice: { include: { consent: true } } } });
  if (!version) return { error: "Version introuvable." };
  if (version.status === "published") return { ok: true };
  if (!consentValid(version.voice.consent)) return { error: "Consentement absent ou révoqué : publication impossible." };
  if (!callpmeTtsConfigured()) return { error: "Serveur d'inférence non configuré (CALLPME_TTS_URL) : la voix ne pourrait pas parler au téléphone." };
  let sample: Uint8Array;
  try {
    sample = await synthesizeWav(version.modelRef, SAMPLE_TEXT, version.voice.language);
  } catch (e) {
    return { error: `Échantillon impossible à générer : ${message(e)}` };
  }
  const v = version.voice;
  const name = `${v.name} (v${version.number})`;
  const last = await prisma.platformVoice.aggregate({ _max: { sortOrder: true } });
  const catalog = {
    name,
    description: v.description,
    gender: v.gender,
    accent: v.accent,
    language: v.language,
    provider: "callpme",
    previewUrl: `/api/voices/inhouse/${version.id}/sample`,
    active: true,
  };
  const platform = await prisma.platformVoice.upsert({
    where: { externalId: version.modelRef },
    create: { ...catalog, externalId: version.modelRef, sortOrder: (last._max.sortOrder ?? 0) + 1 },
    update: catalog,
  });
  await prisma.inhouseVoiceVersion.update({
    where: { id: versionId },
    data: { status: "published", publishedAt: new Date(), platformVoiceId: platform.id, sampleAudio: Buffer.from(sample) },
  });
  refresh(v.id);
  return { ok: true };
}

/**
 * Retire une version du catalogue. La voix est désactivée (plus proposée) mais
 * pas supprimée : les agents qui l'utilisent retombent sur la voix par défaut
 * si le serveur ne la sert plus.
 */
export async function retireInhouseVersion(versionId: string): Promise<InhouseActionResult> {
  await requireAdmin();
  const version = await prisma.inhouseVoiceVersion.findUnique({ where: { id: versionId } });
  if (!version) return { error: "Version introuvable." };
  await prisma.$transaction([
    prisma.inhouseVoiceVersion.update({ where: { id: versionId }, data: { status: "retired" } }),
    ...(version.platformVoiceId ? [prisma.platformVoice.update({ where: { id: version.platformVoiceId }, data: { active: false } })] : []),
  ]);
  refresh(version.voiceId);
  return { ok: true };
}
