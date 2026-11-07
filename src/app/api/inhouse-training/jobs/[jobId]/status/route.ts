import { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/client";
import { badRequest, notFound, ok, unauthorized } from "@/lib/api/respond";
import { canTransition } from "@/lib/voices/inhouse/rules";
import { statusReportSchema, workerAuthorized } from "@/lib/voices/inhouse/worker";
import { completeTraining } from "@/lib/voices/inhouse/store";

export const dynamic = "force-dynamic";

/**
 * POST — rapport d'avancement du serveur GPU. « succeeded » crée la version
 * brouillon (modèle servi sous `cpm_<jobId>`), à écouter puis publier dans l'admin.
 * Réponse { canceled: true } si l'entraînement a été annulé côté Callpme.
 */
export async function POST(req: NextRequest, { params }: { params: { jobId: string } }) {
  if (!workerAuthorized(req.headers.get("authorization"))) return unauthorized();
  const parsed = statusReportSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return badRequest("Rapport invalide.");
  const job = await prisma.inhouseTrainingJob.findUnique({ where: { id: params.jobId } });
  if (!job) return notFound();
  if (job.status === "canceled") return ok({ canceled: true });
  const r = parsed.data;
  // Rapport répété (le worker réessaie) : déjà pris en compte.
  if (r.status === job.status && r.status !== "running") return ok({ ok: true });
  if (!canTransition(job.status, r.status)) return badRequest(`Transition refusée : ${job.status} -> ${r.status}.`);
  let applied: boolean;
  if (r.status === "succeeded") {
    applied = await completeTraining(job.id, job.status, r.message ?? "Entraînement terminé.");
  } else {
    const final = r.status === "failed" || r.status === "canceled";
    // Écriture conditionnée à l'état lu : une annulation simultanée n'est pas écrasée.
    const moved = await prisma.inhouseTrainingJob.updateMany({
      where: { id: job.id, status: job.status },
      data: {
        status: r.status,
        progress: r.progress ?? job.progress,
        message: r.message ?? job.message,
        startedAt: job.startedAt ?? new Date(),
        ...(final ? { finishedAt: new Date() } : {}),
      },
    });
    applied = moved.count > 0;
  }
  if (!applied) {
    const now = await prisma.inhouseTrainingJob.findUnique({ where: { id: job.id }, select: { status: true } });
    return ok({ ok: false, canceled: now?.status === "canceled", status: now?.status });
  }
  revalidatePath(`/admin/voix-maison/${job.voiceId}`);
  return ok({ ok: true });
}
