import { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { getAdminSession } from "@/lib/auth/session";
import { badRequest, notFound, ok } from "@/lib/api/respond";
import { CONSENT_DOC, CONSENT_FORM_VERSION } from "@/lib/voices/inhouse/rules";
import { readFormFile, sameOrigin, sniffConsentDocument } from "@/lib/voices/inhouse/http";

export const dynamic = "force-dynamic";

const schema = z.object({
  speakerName: z.string().trim().min(3).max(120),
  speakerContact: z
    .string()
    .trim()
    .max(160)
    .optional()
    .transform((v) => v || null),
  signedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  attest: z.literal("on"),
});

/**
 * POST — enregistre le consentement signé du locuteur (formulaire + document).
 * L'administrateur atteste avoir vérifié la signature. Un consentement révoqué
 * n'est pas remplacé : il faut créer une nouvelle voix (traçabilité).
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getAdminSession();
  if (!session) return notFound();
  if (!sameOrigin(req)) return badRequest("Origine refusée.");
  const voice = await prisma.inhouseVoice.findUnique({ where: { id: params.id }, include: { consent: { select: { id: true } } } });
  if (!voice) return notFound();
  if (voice.consent) return badRequest("Un consentement est déjà enregistré pour cette voix.");

  const form = await req.formData().catch(() => null);
  if (!form) return badRequest("Formulaire invalide.");
  const parsed = schema.safeParse({
    speakerName: form.get("speakerName"),
    speakerContact: form.get("speakerContact") ?? undefined,
    signedAt: form.get("signedAt"),
    attest: form.get("attest"),
  });
  if (!parsed.success) return badRequest("Nom du locuteur, date de signature et attestation requis.");
  const signedAt = new Date(`${parsed.data.signedAt}T12:00:00Z`);
  if (Number.isNaN(signedAt.getTime()) || signedAt.getTime() > Date.now() + 86_400_000) {
    return badRequest("Date de signature invalide.");
  }

  const file = await readFormFile(form, "document", CONSENT_DOC.maxBytes);
  if ("error" in file) return badRequest(`Formulaire signé : ${file.error}`);
  const mime = sniffConsentDocument(file.bytes);
  if (!mime) return badRequest("Le formulaire signé doit être un PDF, un JPEG ou un PNG.");

  await prisma.inhouseVoiceConsent.create({
    data: {
      voiceId: voice.id,
      speakerName: parsed.data.speakerName,
      speakerContact: parsed.data.speakerContact,
      formVersion: CONSENT_FORM_VERSION,
      signedAt,
      document: Buffer.from(file.bytes),
      documentMime: mime,
      documentName: file.name,
      attestedById: session.user.id,
    },
  });
  revalidatePath(`/admin/voix-maison/${voice.id}`);
  revalidatePath("/admin/voix-maison");
  return ok({ ok: true });
}
