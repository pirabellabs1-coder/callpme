/**
 * Catalogue de voix de la plateforme : les voix proposées à tous les clients,
 * choisies par l'administrateur. Ce sont de vraies voix du fournisseur.
 */
import { prisma } from "@/lib/db/client";
import type { StudioVoiceOption } from "@/components/agents/wizard/state";

export async function listPlatformVoices(opts: { activeOnly?: boolean } = {}) {
  return prisma.platformVoice.findMany({
    where: opts.activeOnly ? { active: true } : undefined,
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

/** Voix de secours : première voix active du catalogue (du genre demandé si possible). */
export async function defaultPlatformVoice(gender?: string | null) {
  const order = [{ sortOrder: "asc" as const }, { createdAt: "asc" as const }];
  const byGender = gender ? await prisma.platformVoice.findFirst({ where: { active: true, gender }, orderBy: order }) : null;
  return byGender ?? (await prisma.platformVoice.findFirst({ where: { active: true }, orderBy: order }));
}
