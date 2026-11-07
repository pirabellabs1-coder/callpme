import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { synthesizeSpeech } from "@/lib/tts/providers";

/** Aperçu de voix : une langue locale suit le même fournisseur et le même modèle qu'au téléphone. */
describe("aperçu de voix : langues locales", () => {
  const fetchMock = vi.fn(async () => new Response(new Uint8Array([1, 2, 3]), { status: 200 }));
  const call = () => fetchMock.mock.calls[0] as unknown as [string | URL, RequestInit];
  const body = () => JSON.parse(String(call()[1].body));
  const url = () => String(call()[0]);

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("ELEVENLABS_API_KEY", "test");
    vi.stubEnv("SPITCH_API_KEY", "");
  });
  afterEach(() => {
    fetchMock.mockClear();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("français : modèle Flash et code fr, comme avant", async () => {
    const r = await synthesizeSpeech({ provider: "elevenlabs", voiceId: "v1", text: "Bonjour", language: "fr-FR" });
    expect(r?.dataUrl).toMatch(/^data:audio\/mpeg;base64,/);
    expect(body().model_id).toBe("eleven_flash_v2_5");
    expect(body().language_code).toBe("fr");
  });

  it("haoussa sans Spitch : ElevenLabs v3 avec le code de la langue", async () => {
    await synthesizeSpeech({ provider: "elevenlabs", voiceId: "v1", text: "Sannu", language: "ha-NG" });
    expect(url()).toContain("api.elevenlabs.io");
    expect(body().model_id).toBe("eleven_v3");
    expect(body().language_code).toBe("ha");
  });

  it("wolof (bilingue imposé) : v4 Turbo, sans langue imposée", async () => {
    await synthesizeSpeech({ provider: "elevenlabs", voiceId: "v1", text: "Na nga def", language: "wo-SN" });
    expect(body().model_id).toBe("eleven_v4_turbo");
    expect(body().language_code).toBeUndefined();
  });

  it("yoruba avec Spitch : voix Spitch de la langue, audio WAV", async () => {
    vi.stubEnv("SPITCH_API_KEY", "test");
    const r = await synthesizeSpeech({ provider: "elevenlabs", voiceId: "v1", text: "Ẹ káàbọ̀", language: "yo-NG" });
    expect(url()).toBe("https://api.spitch.app/v1/speech");
    expect(body()).toMatchObject({ language: "yo", voice: "sade", format: "wav" });
    expect(r?.dataUrl).toMatch(/^data:audio\/wav;base64,/);
  });

  it("yoruba bilingue : ElevenLabs seulement (Spitch ne parle pas français)", async () => {
    vi.stubEnv("SPITCH_API_KEY", "test");
    await synthesizeSpeech({ provider: "elevenlabs", voiceId: "v1", text: "Bonjour, ẹ káàbọ̀", language: "yo-NG", bilingual: true });
    expect(url()).toContain("api.elevenlabs.io");
    expect(body().language_code).toBeUndefined();
  });

  it("langue locale avec une voix non ElevenLabs : pas d'audio (repli navigateur)", async () => {
    vi.stubEnv("CARTESIA_API_KEY", "test");
    const r = await synthesizeSpeech({ provider: "cartesia", voiceId: "c1", text: "Sannu", language: "ha-NG" });
    expect(r).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
