/**
 * Voix du Studio d'une organisation : une voix du catalogue Callpme réglée par
 * le client (réglages ElevenLabs + dictionnaire de prononciation), enregistrée
 * dans la table Voice et réutilisable par tous ses agents.
 */
import { prisma } from "@/lib/db/client";
import type { StudioExtras } from "@/lib/voice-engine/tts";
import { parseStudioSettings } from "./tuning";

/** Réglages Studio de la voix `voiceId` de l'organisation, ou null si ce n'en est pas une. */
export async function loadStudioExtras(organizationId: string, voiceId: string | undefined | null): Promise<StudioExtras | null> {
  if (!voiceId) return null;
  const row = await prisma.voice.findFirst({ where: { id: voiceId, organizationId }, select: { settings: true, provider: true } });
  if (!row) return null;
  const s = parseStudioSettings(row.settings);
  return {
    voiceId: s.externalVoiceId,
    provider: row.provider,
    // Sans réglages enregistrés (voix clonée), la vitesse de l'agent s'applique.
    tuning: s.customTuning ? s.tuning : undefined,
    pronunciations: s.pronunciations,
  };
}
