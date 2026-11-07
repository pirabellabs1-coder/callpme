"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { requireAdmin } from "@/lib/auth/session";
import { addLibraryVoice, listAccountVoices, searchLibrary, type LibraryFilters, type LibraryVoice } from "@/lib/voices/elevenlabs";

export interface VoiceActionResult {
  ok?: boolean;
  error?: string;
}

function refresh() {
  revalidatePath("/admin/voices");
  revalidatePath("/voices");
}

const message = (e: unknown) => (e instanceof Error ? e.message : "Erreur inattendue.");

const filtersSchema = z.object({
  search: z.string().trim().max(80).optional(),
  gender: z.enum(["", "female", "male", "neutral"]).optional(),
  age: z.enum(["", "young", "middle_aged", "old"]).optional(),
  accent: z.string().trim().max(40).optional(),
  useCase: z.string().regex(/^[a-z_]{0,40}$/).optional(),
  language: z.string().regex(/^[a-z]{0,10}$/).optional(),
  page: z.number().int().min(0).max(50).optional(),
});

/** Recherche dans la bibliothèque ElevenLabs (voix françaises). */
export async function searchVoiceLibrary(
  filters: LibraryFilters,
): Promise<{ voices?: LibraryVoice[]; hasMore?: boolean; error?: string }> {
  await requireAdmin();
  const parsed = filtersSchema.safeParse(filters);
  if (!parsed.success) return { error: "Filtres de recherche invalides." };
  try {
    return await searchLibrary(parsed.data);
  } catch (e) {
    return { error: message(e) };
  }
}

/** Voix déjà présentes dans le compte ElevenLabs de la plateforme. */
export async function listElevenLabsAccountVoices(): Promise<{ voices?: LibraryVoice[]; error?: string }> {
  await requireAdmin();
  try {
    return { voices: await listAccountVoices() };
  } catch (e) {
    return { error: message(e) };
  }
}

const importSchema = z.object({
  voiceId: z.string().regex(/^[A-Za-z0-9_-]{6,64}$/),
  ownerId: z.string().regex(/^[A-Za-z0-9_-]{6,80}$/).nullable(),
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(300).nullable(),
  gender: z.enum(["feminine", "masculine", "neutral"]).nullable(),
  age: z.string().max(30).nullable(),
  accent: z.string().max(60).nullable(),
  language: z.string().max(10).nullable(),
  useCase: z.string().max(60).nullable(),
  previewUrl: z.string().url().max(600).refine((u) => u.startsWith("https://"), "https requis").nullable(),
});

/**
 * Ajoute une voix au catalogue Callpme. Une voix de la bibliothèque publique est
 * d'abord ajoutée au compte ElevenLabs (sinon elle n'est pas utilisable en appel).
 */
export async function importVoiceToCatalog(input: z.input<typeof importSchema>): Promise<VoiceActionResult> {
  await requireAdmin();
  const parsed = importSchema.safeParse(input);
  if (!parsed.success) return { error: "Données de voix invalides." };
  const v = parsed.data;
  // Doublon vérifié AVANT l'ajout chez ElevenLabs (pas de voix ajoutée pour rien).
  if (await prisma.platformVoice.findUnique({ where: { externalId: v.voiceId } })) {
    return { error: "Cette voix est déjà dans le catalogue." };
  }
  try {
    const externalId = v.ownerId ? await addLibraryVoice(v.ownerId, v.voiceId, `Callpme · ${v.name}`) : v.voiceId;
    const last = await prisma.platformVoice.aggregate({ _max: { sortOrder: true } });
    await prisma.platformVoice.create({
      data: {
        name: v.name,
        description: v.description,
        gender: v.gender,
        age: v.age,
        accent: v.accent,
        language: (v.language || "fr").slice(0, 10),
        useCase: v.useCase,
        provider: "elevenlabs",
        externalId,
        previewUrl: v.previewUrl,
        sortOrder: (last._max.sortOrder ?? 0) + 1,
      },
    });
    refresh();
    return { ok: true };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: "Cette voix est déjà dans le catalogue." };
    }
    return { error: message(e) };
  }
}

const updateSchema = z.object({
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(300).nullable(),
  gender: z.enum(["feminine", "masculine", "neutral"]).nullable(),
  accent: z.string().trim().max(60).nullable(),
  active: z.boolean(),
});

/** Modifie le nom, la description, le genre, l'accent ou la disponibilité d'une voix. */
export async function updateCatalogVoice(id: string, input: z.input<typeof updateSchema>): Promise<VoiceActionResult> {
  await requireAdmin();
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { error: "Nom de 2 à 60 caractères requis." };
  const d = parsed.data;
  // Voix maison : réactivable seulement si sa version est publiée et le consentement valide.
  if (d.active) {
    const current = await prisma.platformVoice.findUnique({ where: { id }, select: { provider: true } });
    if (current?.provider === "callpme" && !(await inhouseVersionPublished(id))) {
      return { error: "Voix maison retirée ou consentement révoqué : republiez-la depuis « Voix maison »." };
    }
  }
  try {
    await prisma.platformVoice.update({
      where: { id },
      data: { ...d, description: d.description || null, accent: d.accent || null },
    });
  } catch {
    return { error: "Voix introuvable." };
  }
  refresh();
  return { ok: true };
}

async function inhouseVersionPublished(platformVoiceId: string): Promise<boolean> {
  const v = await prisma.inhouseVoiceVersion.findFirst({
    where: { platformVoiceId, status: "published", voice: { consent: { is: { revokedAt: null } } } },
    select: { id: true },
  });
  return Boolean(v);
}

/** Change l'ordre d'affichage (vers le haut ou vers le bas). */
export async function moveCatalogVoice(id: string, direction: "up" | "down"): Promise<VoiceActionResult> {
  await requireAdmin();
  const voices = await prisma.platformVoice.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }], select: { id: true } });
  const i = voices.findIndex((v) => v.id === id);
  const j = direction === "up" ? i - 1 : i + 1;
  if (i < 0 || j < 0 || j >= voices.length) return { ok: true };
  [voices[i], voices[j]] = [voices[j], voices[i]];
  await prisma.$transaction(voices.map((v, n) => prisma.platformVoice.update({ where: { id: v.id }, data: { sortOrder: n } })));
  refresh();
  return { ok: true };
}

/**
 * Retire une voix du catalogue. Refusé si des agents l'utilisent encore :
 * il faut d'abord la désactiver (plus proposée) puis changer la voix de ces agents.
 */
export async function deleteCatalogVoice(id: string): Promise<VoiceActionResult> {
  await requireAdmin();
  const voice = await prisma.platformVoice.findUnique({ where: { id }, select: { externalId: true } });
  if (!voice) return { ok: true };
  // Agents ET versions d'agents (tests A/B) qui pourraient encore utiliser cette voix.
  const [agents, versions] = await Promise.all([
    prisma.agent.count({ where: { config: { contains: voice.externalId } } }),
    prisma.agentVersion.count({ where: { config: { contains: voice.externalId } } }),
  ]);
  const inUse = agents + versions;
  if (inUse > 0) {
    return { error: `${inUse} agent(s) utilisent cette voix : désactivez-la plutôt (elle ne sera plus proposée).` };
  }
  await prisma.platformVoice.delete({ where: { id } });
  refresh();
  return { ok: true };
}
