/**
 * Voix « fournisseur » d'une voix Studio : identifiant chez ElevenLabs ou
 * Cartesia (voix ajoutée par ID, ou clonée depuis un enregistrement).
 * Module pur, utilisable côté client.
 */
export function externalVoiceId(settings: string | null | undefined): string | undefined {
  if (!settings) return undefined;
  try {
    const id = (JSON.parse(settings) as { externalVoiceId?: unknown }).externalVoiceId;
    return typeof id === "string" && /^[A-Za-z0-9_-]{6,64}$/.test(id) ? id : undefined;
  } catch {
    return undefined;
  }
}

/** Option de voix Studio proposée dans la configuration d'un agent. */
export function studioVoiceOption(v: {
  id: string;
  name: string;
  gender: string | null;
  sampleUrl: string | null;
  provider: string;
  settings: string | null;
}) {
  const providerVoiceId = externalVoiceId(v.settings);
  return {
    id: v.id,
    name: v.name,
    gender: v.gender,
    sampleUrl: v.sampleUrl,
    provider: v.provider,
    providerVoiceId: providerVoiceId && (v.provider === "elevenlabs" || v.provider === "cartesia") ? providerVoiceId : undefined,
  };
}
