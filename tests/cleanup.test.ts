import { afterEach, describe, expect, it } from "vitest";
import { describeEvent, isSlackWebhook } from "@/lib/integrations/automations";
import { externalVoiceId, studioVoiceOption } from "@/lib/voices/provider-voice";
import { resolveVoice } from "@/lib/voice-engine/tts";
import type { Agent } from "@/lib/shared/types";

const env = { ...process.env };
afterEach(() => {
  process.env = { ...env };
});

describe("alertes Slack / automatisations", () => {
  it("n'accepte que les vrais webhooks Slack", () => {
    expect(isSlackWebhook("https://hooks.slack.com/services/T000/B000/XXXX")).toBe(true);
    expect(isSlackWebhook("https://hooks.slack.com.pirate.io/services/x")).toBe(false);
    expect(isSlackWebhook("http://hooks.slack.com/services/x")).toBe(false);
  });

  it("résume les événements en clair", () => {
    expect(describeEvent("call.completed", { agentName: "Léa", durationSec: 130, outcome: "RDV pris", summary: "Détartrage jeudi." })).toBe(
      "Appel terminé · Léa · 2 min · RDV pris\nDétartrage jeudi.",
    );
    expect(describeEvent("lead.created", { kind: "callback", name: "Awa", phone: "+22901970000" })).toContain("rappel demandé : Awa");
  });
});

describe("voix Studio au téléphone", () => {
  it("lit l'identifiant fournisseur d'une voix clonée ou ajoutée par ID", () => {
    expect(externalVoiceId(JSON.stringify({ externalVoiceId: "21m00Tcm4TlvDq8ikWAM" }))).toBe("21m00Tcm4TlvDq8ikWAM");
    expect(externalVoiceId(JSON.stringify({ externalVoiceId: "../../x" }))).toBeUndefined();
    const opt = studioVoiceOption({ id: "v1", name: "Awa", gender: null, sampleUrl: null, provider: "elevenlabs", settings: '{"externalVoiceId":"abcdef123"}' });
    expect(opt.providerVoiceId).toBe("abcdef123");
    expect(studioVoiceOption({ id: "v2", name: "x", gender: null, sampleUrl: "data:", provider: "custom", settings: '{"externalVoiceId":"abcdef123"}' }).providerVoiceId).toBeUndefined();
  });

  it("le moteur vocal utilise l'identifiant fournisseur, pas l'identifiant Callpme", () => {
    process.env.ELEVENLABS_API_KEY = "k";
    delete process.env.CARTESIA_API_KEY;
    const agent = {
      config: { voice: { provider: "elevenlabs", voiceId: "cuid_callpme", providerVoiceId: "abcdef123", kind: "provider", language: "fr-FR", speed: 1 } },
    } as unknown as Agent;
    expect(resolveVoice(agent)).toEqual({ provider: "elevenlabs", voiceId: "abcdef123", language: "fr-FR" });
  });
});
