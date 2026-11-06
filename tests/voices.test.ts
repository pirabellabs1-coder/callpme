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
