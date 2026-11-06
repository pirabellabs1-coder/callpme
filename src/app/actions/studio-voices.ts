"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { isOrgAdmin, requireSession } from "@/lib/auth/session";
import { parseStudioSettings, pronunciationsSchema, tuningSchema, type StudioVoiceSettings } from "@/lib/voices/tuning";

export interface StudioVoiceResult {
  ok?: boolean;
  error?: string;
  id?: string;
}

const MAX_STUDIO_VOICES = 30;

const saveSchema = z.object({
  id: z.string().max(40).optional(),
  name: z.string().trim().min(2, "Nom de 2 à 60 caractères.").max(60, "Nom de 2 à 60 caractères."),
  description: z.string().trim().max(300).optional(),
  baseVoiceId: z.string().min(1).max(40),
  tuning: tuningSchema,
  pronunciations: pronunciationsSchema,
});

/**
 * Enregistre une voix du Studio : une voix du catalogue Callpme avec les
 * réglages et le dictionnaire de prononciation du client. Les agents qui
 * l'utilisent prennent les nouveaux réglages dès l'appel suivant.
 */
export async function saveStudioVoice(input: z.input<typeof saveSchema>): Promise<StudioVoiceResult> {
  const session = await requireSession();
  if (!isOrgAdmin(session)) return { error: "Réservé aux administrateurs de l'organisation." };
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || "Réglages invalides." };
  const d = parsed.data;
  const orgId = session.org.id;

  const existing = d.id
    ? await prisma.voice.findFirst({ where: { id: d.id, organizationId: orgId }, select: { id: true, settings: true } })
    : null;
  if (d.id && !existing) return { error: "Voix introuvable." };
  const base = await prisma.platformVoice.findUnique({ where: { id: d.baseVoiceId } });
  // Une voix retirée du catalogue reste utilisable par les voix qui en partaient déjà.
  const keptBase = existing ? parseStudioSettings(existing.settings).baseVoiceId === d.baseVoiceId : false;
  if (!base || (!base.active && !keptBase)) return { error: "Cette voix du catalogue n'est plus disponible." };
  const settings: StudioVoiceSettings & { studio: true } = {
    studio: true,
    externalVoiceId: base.externalId,
    baseVoiceId: base.id,
    tuning: d.tuning,
    pronunciations: d.pronunciations,
  };
  const data = {
    name: d.name,
    description: d.description || null,
    provider: base.provider,
    status: "ready",
    gender: base.gender,
    accent: base.accent,
    settings: JSON.stringify(settings),
    sampleUrl: null,
  };

  if (existing) {
    await prisma.voice.update({ where: { id: existing.id }, data });
    revalidatePath("/voices");
    return { ok: true, id: existing.id };
  }
  const count = await prisma.voice.count({ where: { organizationId: orgId } });
  if (count >= MAX_STUDIO_VOICES) return { error: `${MAX_STUDIO_VOICES} voix au maximum : supprimez-en une d'abord.` };
  const created = await prisma.voice.create({ data: { ...data, organizationId: orgId } });
  revalidatePath("/voices");
  return { ok: true, id: created.id };
}

/** Supprime une voix du Studio, sauf si un agent l'utilise encore. */
export async function deleteStudioVoice(id: string): Promise<StudioVoiceResult> {
  const session = await requireSession();
  if (!isOrgAdmin(session)) return { error: "Réservé aux administrateurs de l'organisation." };
  const orgId = session.org.id;
  const voice = await prisma.voice.findFirst({ where: { id, organizationId: orgId }, select: { id: true } });
  if (!voice) return { ok: true };
  const needle = `"voiceId":"${voice.id}"`;
  const [agents, versions] = await Promise.all([
    prisma.agent.count({ where: { organizationId: orgId, config: { contains: needle } } }),
    prisma.agentVersion.count({ where: { agent: { organizationId: orgId }, config: { contains: needle } } }),
  ]);
  if (agents + versions > 0) {
    return { error: `${agents + versions} agent(s) utilisent cette voix : choisissez-leur d'abord une autre voix.` };
  }
  await prisma.voice.delete({ where: { id: voice.id } });
  revalidatePath("/voices");
  return { ok: true };
}
