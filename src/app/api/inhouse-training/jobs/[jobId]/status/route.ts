import { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/client";
import { badRequest, notFound, ok, unauthorized } from "@/lib/api/respond";
import { canTransition } from "@/lib/voices/inhouse/rules";
import { statusReportSchema, workerAuthorized } from "@/lib/voices/inhouse/worker";
import { createDraftVersion } from "@/lib/voices/inhouse/store";

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
  if (!canTransition(job.status, r.status)) return badRequest(`Transition refusée : ${job.status} -> ${r.status}.`);
  const final = r.status === "succeeded" || r.status === "failed" || r.status === "canceled";
  await prisma.inhouseTrainingJob.update({
    where: { id: job.id },
    data: {
      status: r.status,
      progress: r.status === "succeeded" ? 100 : (r.progress ?? job.progress),
      message: r.message ?? job.message,
      startedAt: job.startedAt ?? new Date(),
      ...(final ? { finishedAt: new Date() } : {}),
    },
  });
  if (r.status === "succeeded") await createDraftVersion(job.id);
  revalidatePath(`/admin/voix-maison/${job.voiceId}`);
  return ok({ ok: true });
}
