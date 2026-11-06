import { prisma } from "@/lib/db/client";
import { getSession } from "@/lib/auth/session";
import { notFound, unauthorized } from "@/lib/api/respond";
import { binaryResponse } from "@/lib/voices/inhouse/http";

export const dynamic = "force-dynamic";

/**
 * GET — échantillon d'une voix maison publiée (aperçu du catalogue, clients
 * connectés). Généré une seule fois à la publication : aucune écoute ne coûte
 * de GPU. Plus servi dès que la version est retirée.
 */
export async function GET(_req: Request, { params }: { params: { versionId: string } }) {
  if (!(await getSession())) return unauthorized();
  const v = await prisma.inhouseVoiceVersion.findUnique({ where: { id: params.versionId }, select: { status: true, sampleAudio: true } });
  if (!v || v.status !== "published" || !v.sampleAudio) return notFound();
  return binaryResponse(v.sampleAudio, "audio/wav");
}
