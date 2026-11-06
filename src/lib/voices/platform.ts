/**
 * Catalogue de voix de la plateforme : les voix proposées à tous les clients,
 * choisies par l'administrateur. Ce sont de vraies voix du fournisseur.
 */
import { prisma } from "@/lib/db/client";
import type { StudioVoiceOption } from "@/components/agents/wizard/state";
import { callpmeTtsConfigured } from "@/lib/voice-engine/callpme-tts";

/**
 * Voix du catalogue. Avec `activeOnly` (choix des clients), les voix maison
 * ne sont proposées que si notre serveur d'inférence est configuré.
 */
export async function listPlatformVoices(opts: { activeOnly?: boolean } = {}) {
  return prisma.platformVoice.findMany({
    where: opts.activeOnly
      ? { active: true, ...(callpmeTtsConfigured() ? {} : { provider: { not: "callpme" } }) }
      : undefined,
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
}

export type PlatformVoiceRow = Awaited<ReturnType<typeof listPlatformVoices>>[number];

/** Option de voix pour la configuration d'un agent (même forme que les voix Studio). */
export function platformVoiceOption(v: PlatformVoiceRow): StudioVoiceOption {
  return {
    id: v.id,
    name: v.name,
    gender: v.gender,
    sampleUrl: v.previewUrl,
    provider: v.provider,
    providerVoiceId: v.externalId,
    description: v.description,
    accent: v.accent,
    catalog: true,
  };
}

/**
 * Voix de secours : première voix active du catalogue (du genre demandé si possible).
 * Jamais une voix maison : la secours doit fonctionner chez le fournisseur du moteur.
 */
export async function defaultPlatformVoice(gender?: string | null) {
  const order = [{ sortOrder: "asc" as const }, { createdAt: "asc" as const }];
  const base = { active: true, provider: { not: "callpme" } };
  const byGender = gender ? await prisma.platformVoice.findFirst({ where: { ...base, gender }, orderBy: order }) : null;
  return byGender ?? (await prisma.platformVoice.findFirst({ where: base, orderBy: order }));
}

/**
 * Une voix maison n'est utilisable au téléphone que si elle est encore
 * publiée et active au catalogue (retrait ou consentement révoqué = coupure).
 */
export async function inhouseVoiceAvailable(externalId: string | null | undefined): Promise<boolean> {
  if (!externalId) return false;
  const v = await prisma.platformVoice.findFirst({ where: { externalId, provider: "callpme", active: true }, select: { id: true } });
  return Boolean(v);
}
