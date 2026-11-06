import { afterEach, describe, expect, it } from "vitest";
import { mapGender } from "@/lib/voices/elevenlabs";
import { resolveVoice } from "@/lib/voice-engine/tts";
import type { Agent } from "@/lib/shared/types";

function agentWith(voice: Partial<Agent["config"]["voice"]>): Agent {
  return {
    config: { voice: { provider: "elevenlabs", voiceId: "", language: "fr-FR", speed: 1, ...voice } },
  } as unknown as Agent;
}

describe("voix ElevenLabs", () => {
  it("traduit le genre ElevenLabs", () => {
    expect(mapGender("female")).toBe("feminine");
    expect(mapGender("Male")).toBe("masculine");
    expect(mapGender("neutral")).toBe("neutral");
    expect(mapGender("autre")).toBeNull();
    expect(mapGender(undefined)).toBeNull();
  });
});

describe("voix utilisée au téléphone", () => {
  const env = { ...process.env };
  afterEach(() => {
    process.env = { ...env };
  });

  it("prend la vraie voix choisie pour l'agent", () => {
    process.env.ELEVENLABS_API_KEY = "x";
    const v = resolveVoice(agentWith({ kind: "provider", providerVoiceId: "voixChoisie1" }), "voixCatalogue");
    expect(v?.voiceId).toBe("voixChoisie1");
  });

  it("sans voix choisie, prend la première voix du catalogue", () => {
    process.env.ELEVENLABS_API_KEY = "x";
    delete process.env.VOICE_DEFAULT_FEMALE_ID;
    expect(resolveVoice(agentWith({ voiceId: "lea" }), "voixCatalogue")?.voiceId).toBe("voixCatalogue");
  });

  it("sans catalogue ni voix par défaut, aucune voix", () => {
    process.env.ELEVENLABS_API_KEY = "x";
    delete process.env.VOICE_DEFAULT_FEMALE_ID;
    expect(resolveVoice(agentWith({}), null)).toBeNull();
  });
});

describe("voix choisie dans l'assistant de création", () => {
  it("enregistre une voix du catalogue comme vraie voix ElevenLabs", async () => {
    const { buildPayload, initialState } = await import("@/components/agents/wizard/state");
    const s = { ...initialState(), name: "Accueil", role: "support" as const, voiceId: "pv1" };
    const payload = buildPayload(s, {
      asDraft: true,
      studio: { id: "pv1", name: "Alimata", gender: "feminine", sampleUrl: "https://x/p.mp3", provider: "elevenlabs", providerVoiceId: "voixAlimata1", catalog: true },
    });
    expect(payload.config.voice).toMatchObject({
      provider: "elevenlabs",
      kind: "provider",
      providerVoiceId: "voixAlimata1",
      voiceLabel: "Alimata",
      sampleUrl: null,
    });
  });
});

describe("Studio : réglages et prononciation", () => {
  it("remplace les mots du dictionnaire, mot entier, sans tenir compte de la casse", async () => {
    const { applyPronunciations } = await import("@/lib/voices/tuning");
    const dico = [
      { word: "MTN", say: "èm-té-ène" },
      { word: "MTN Bénin", say: "èm-té-ène Bénin" },
      { word: "Cotonou", say: "Ko-to-nou" },
    ];
    expect(applyPronunciations("Bienvenue chez MTN Bénin à cotonou.", dico)).toBe("Bienvenue chez èm-té-ène Bénin à Ko-to-nou.");
    expect(applyPronunciations("MTNX et AMTN restent tels quels", dico)).toBe("MTNX et AMTN restent tels quels");
    expect(applyPronunciations("Prix (MTN) ?", [{ word: "(MTN)", say: "x" }])).toBe("Prix x ?");
    expect(applyPronunciations("rien", [])).toBe("rien");
  });

  it("borne les réglages lus depuis du JSON non fiable", async () => {
    const { normalizeTuning } = await import("@/lib/voices/tuning");
    expect(normalizeTuning({ stability: 3, similarity: -1, style: "x", speed: 5, speakerBoost: "oui" })).toEqual({
      stability: 1,
      similarity: 0,
      style: 0,
      speed: 1.2,
      speakerBoost: true,
    });
    expect(normalizeTuning(null, 0.9).speed).toBe(0.9);
  });

  it("au téléphone, applique la voix et les réglages du Studio", () => {
    process.env.ELEVENLABS_API_KEY = "x";
    const tuning = { stability: 0.8, similarity: 0.7, style: 0.1, speed: 0.9, speakerBoost: false };
    const v = resolveVoice(agentWith({ kind: "provider", providerVoiceId: "ancienne01", voiceId: "studio1" }), null, {
      voiceId: "nouvelleBase1",
      tuning,
      pronunciations: [{ word: "MTN", say: "èm-té-ène" }],
    });
    expect(v).toMatchObject({ voiceId: "nouvelleBase1", tuning, pronunciations: [{ word: "MTN", say: "èm-té-ène" }] });
  });

  it("voix Studio d'un autre fournisseur : son fournisseur prime sur celui de l'agent", () => {
    process.env.ELEVENLABS_API_KEY = "x";
    delete process.env.CARTESIA_API_KEY;
    const v = resolveVoice(agentWith({ provider: "cartesia" as never, kind: "provider", providerVoiceId: "ancienne01" }), null, {
      voiceId: "voixEleven1",
      provider: "elevenlabs",
    });
    expect(v?.voiceId).toBe("voixEleven1");
  });

  it("voix clonée sans réglages : la vitesse de l'agent s'applique", () => {
    process.env.ELEVENLABS_API_KEY = "x";
    const v = resolveVoice(agentWith({ kind: "provider", providerVoiceId: "clone01", speed: 0.9 }), null, { voiceId: "clone01", provider: "elevenlabs" });
    expect(v?.tuning?.speed).toBe(0.9);
  });

  it("sans Studio, la vitesse de l'agent est reprise dans les réglages", () => {
    process.env.ELEVENLABS_API_KEY = "x";
    const v = resolveVoice(agentWith({ kind: "provider", providerVoiceId: "voixChoisie1", speed: 0.85 }), null);
    expect(v?.tuning?.speed).toBe(0.85);
  });
});
