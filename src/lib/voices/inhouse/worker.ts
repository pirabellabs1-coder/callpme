/**
 * Serveur d'entraînement GPU des voix maison — client et authentification.
 *
 * ÉTAT : interface documentée. Le serveur GPU lui-même n'est pas encore
 * hébergé (voir docs/voix-maison.md). Tant que CALLPME_TRAINING_URL est
 * absent, un entraînement lancé reste « en file d'attente » avec un message
 * explicite : rien n'est simulé.
 *
 * Contrat (annexe B de la doc) :
 *  1. Callpme -> worker : POST {CALLPME_TRAINING_URL}/v1/jobs
 *     { jobId, modelRef, baseModel, language, datasetUrl, statusUrl }
 *     -> 202 { "externalJobId": "..." }
 *  2. worker -> Callpme : GET datasetUrl (manifeste JSON), puis chaque clip.
 *  3. worker -> Callpme : POST statusUrl { status, progress?, message? }
 *     jusqu'à « succeeded » (le modèle est alors servi sous `modelRef`).
 * Les appels du worker portent « Authorization: Bearer CALLPME_TRAINING_SECRET ».
 */
import { z } from "zod";
import { safeEqual } from "@/lib/auth/admin-gate";

export function trainingWorkerUrl(): string | null {
  const raw = process.env.CALLPME_TRAINING_URL?.trim();
  if (!raw) return null;
  try {
    const u = new URL(raw);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString().replace(/\/+$/, "") : null;
  } catch {
    return null;
  }
}

/** Secret partagé avec le worker (32 caractères minimum, sinon refusé). */
function workerSecret(): string | null {
  const s = process.env.CALLPME_TRAINING_SECRET;
  return s && s.length >= 32 ? s : null;
}

export const trainingConfigured = () => trainingWorkerUrl() !== null && workerSecret() !== null;

/** Vérifie l'en-tête Authorization d'un appel du worker (comparaison à temps constant). */
export function workerAuthorized(header: string | null): boolean {
  const secret = workerSecret();
  if (!secret || !header?.startsWith("Bearer ")) return false;
  return safeEqual(header.slice(7), secret);
}

/** Rapport d'avancement envoyé par le worker. */
export const statusReportSchema = z.object({
  status: z.enum(["submitted", "running", "succeeded", "failed", "canceled"]),
  progress: z.number().int().min(0).max(100).optional(),
  message: z.string().trim().max(500).optional(),
});
export type StatusReport = z.infer<typeof statusReportSchema>;

export interface WorkerJob {
  jobId: string;
  modelRef: string;
  baseModel: string;
  language: string;
  datasetUrl: string;
  statusUrl: string;
}

/** Soumet un entraînement au worker. Renvoie son identifiant côté worker. */
export async function submitTrainingJob(job: WorkerJob): Promise<{ externalJobId: string | null }> {
  const base = trainingWorkerUrl();
  const secret = workerSecret();
  if (!base || !secret) throw new Error("Serveur d'entraînement non configuré.");
  const res = await fetch(`${base}/v1/jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${secret}` },
    body: JSON.stringify(job),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Serveur d'entraînement : HTTP ${res.status}.`);
  const data = (await res.json().catch(() => ({}))) as { externalJobId?: unknown };
  const id = typeof data.externalJobId === "string" ? data.externalJobId.slice(0, 120) : null;
  return { externalJobId: id };
}
