import { prisma } from "@/lib/db/client";
import { getAdminSession } from "@/lib/auth/session";
import { notFound } from "@/lib/api/respond";
import { binaryResponse } from "@/lib/voices/inhouse/http";

export const dynamic = "force-dynamic";

/** GET — formulaire de consentement signé (preuve), réservé au super-admin. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  if (!(await getAdminSession())) return notFound();
  const c = await prisma.inhouseVoiceConsent.findUnique({
    where: { voiceId: params.id },
    select: { document: true, documentMime: true, documentName: true },
  });
  if (!c) return notFound();
  return binaryResponse(c.document, c.documentMime, c.documentName);
}
