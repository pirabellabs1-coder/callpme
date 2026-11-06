/** Données communes des pages du Studio de voix. */
import { listPlatformVoices } from "./platform";
import type { StudioBaseVoice } from "@/components/voices/voice-studio";

export async function studioBaseVoices(includeId?: string): Promise<StudioBaseVoice[]> {
  const all = await listPlatformVoices();
  return all
    .filter((v) => v.active || v.id === includeId)
    .map((v) => ({
      id: v.id,
      name: v.name,
      gender: v.gender,
      accent: v.accent,
      provider: v.provider,
      externalId: v.externalId,
      previewUrl: v.previewUrl,
    }));
}
