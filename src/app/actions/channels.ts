"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { isOrgAdmin, requireSession } from "@/lib/auth/session";
import { encryptSecret } from "@/lib/crypto/secrets";
import { checkWhatsAppCredentials } from "@/lib/whatsapp/cloud";
import { isRateLimited } from "@/lib/security/rate-limit";

export interface ChannelResult {
  ok?: boolean;
  error?: string;
}

const schema = z.object({
  agentId: z.string().min(5).max(60),
  phoneNumberId: z.string().trim().regex(/^\d{5,30}$/, "« Phone number ID » : uniquement des chiffres (voir WhatsApp Manager › API Setup)."),
  accessToken: z.string().trim().max(1000),
  appSecret: z.string().trim().max(200),
});

/** Connecte (ou met à jour) le numéro WhatsApp Business de l'organisation. */
export async function saveWhatsAppChannel(formData: FormData): Promise<ChannelResult> {
  const session = await requireSession();
  if (!isOrgAdmin(session)) return { error: "Réservé aux administrateurs de l'organisation." };
  if (isRateLimited(`wa-save:${session.org.id}`, 10, 60 * 60_000)) return { error: "Trop de tentatives. Réessayez plus tard." };
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Données invalides." };
  const d = parsed.data;

  const agent = await prisma.agent.findFirst({ where: { id: d.agentId, organizationId: session.org.id }, select: { id: true } });
  if (!agent) return { error: "Choisissez un de vos agents." };
  const existing = await prisma.whatsAppChannel.findUnique({ where: { organizationId: session.org.id } });
  const other = await prisma.whatsAppChannel.findUnique({ where: { phoneNumberId: d.phoneNumberId } });
  if (other && other.organizationId !== session.org.id) return { error: "Ce numéro WhatsApp est déjà relié à un autre compte Callpme." };

  // Jeton et secret : obligatoires à la première connexion, conservés s'ils sont laissés vides ensuite.
  const token = d.accessToken || null;
  if (!existing && (!d.accessToken || !d.appSecret)) return { error: "Le jeton d'accès et le secret de l'application sont requis." };
  if (d.appSecret && !/^[a-f0-9]{32}$/i.test(d.appSecret)) return { error: "Secret de l'application : 32 caractères (Meta for Developers › Paramètres › De base)." };

  let displayNumber = existing?.displayNumber ?? null;
  if (token || d.phoneNumberId !== existing?.phoneNumberId) {
    const { decryptSecret } = await import("@/lib/crypto/secrets");
    const check = await checkWhatsAppCredentials(d.phoneNumberId, token ?? decryptSecret(existing?.accessToken) ?? "");
    if (check === null) return { error: "Meta refuse ces identifiants : vérifiez le Phone number ID et le jeton d'accès." };
    displayNumber = check || null;
  }

  const data = {
    agentId: agent.id,
    phoneNumberId: d.phoneNumberId,
    displayNumber,
    ...(token ? { accessToken: encryptSecret(token)! } : {}),
    ...(d.appSecret ? { appSecret: encryptSecret(d.appSecret)! } : {}),
    enabled: true,
  };
  try {
  if (existing) {
    await prisma.whatsAppChannel.update({ where: { id: existing.id }, data });
  } else {
    await prisma.whatsAppChannel.create({
      data: {
        ...data,
        accessToken: encryptSecret(d.accessToken)!,
        appSecret: encryptSecret(d.appSecret)!,
        organizationId: session.org.id,
        verifyToken: randomBytes(24).toString("base64url"),
      },
    });
  }
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") return { error: "Ce numéro WhatsApp est déjà relié à un autre compte Callpme." };
    throw e;
  }
  revalidatePath("/channels");
  return { ok: true };
}

export async function setWhatsAppEnabled(enabled: boolean): Promise<ChannelResult> {
  const session = await requireSession();
  if (!isOrgAdmin(session)) return { error: "Réservé aux administrateurs de l'organisation." };
  await prisma.whatsAppChannel.updateMany({ where: { organizationId: session.org.id }, data: { enabled } });
  revalidatePath("/channels");
  return { ok: true };
}

export async function removeWhatsAppChannel(): Promise<ChannelResult> {
  const session = await requireSession();
  if (!isOrgAdmin(session)) return { error: "Réservé aux administrateurs de l'organisation." };
  await prisma.whatsAppChannel.deleteMany({ where: { organizationId: session.org.id } });
  revalidatePath("/channels");
  return { ok: true };
}
