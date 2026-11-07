import { prisma } from "@/lib/db/client";
import { getAdminSession } from "@/lib/auth/session";
import { notFound } from "@/lib/api/respond";
import { binaryResponse } from "@/lib/voices/inhouse/http";

export const dynamic = "force-dynamic";

/** GET — écoute d'un clip du jeu de données (super-admin uniquement). */
export async function GET(_req: Request, { params }: { params: { clipId: string } }) {
  if (!(await getAdminSession())) return notFound();
  const clip = await prisma.inhouseVoiceClip.findUnique({ where: { id: params.clipId }, select: { audio: true, mimeType: true } });
  if (!clip) return notFound();
  return binaryResponse(clip.audio, clip.mimeType);
}
