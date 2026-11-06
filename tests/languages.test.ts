import { afterEach, describe, expect, it, vi } from "vitest";
import {
  bilingualRequired,
  effectiveBilingual,
  isRejectedLanguage,
  isSelectableLanguage,
  languageInstructions,
  providerLanguageCode,
  sttLanguageCode,
  VOICE_LANGUAGES,
} from "@/lib/voice-engine/languages";
import { batchTranscriber, sttProviderFor } from "@/lib/voice-engine/stt";
import { elevenLabsModel, resolveVoice, ttsProviderFor, WavToMulaw } from "@/lib/voice-engine/tts";
import { encodeMulaw, wavFromPcm16 } from "@/lib/voice-engine/audio";
import { CostMeter } from "@/lib/costs/meter";
import { languageField } from "@/lib/validation/agent";
import type { Agent } from "@/lib/shared/types";

const env = { ...process.env };
afterEach(() => {
  process.env = { ...env };
  vi.unstubAllGlobals();
});

function clearKeys() {
  for (const k of ["DEEPGRAM_API_KEY", "ELEVENLABS_API_KEY", "CARTESIA_API_KEY", "SPITCH_API_KEY", "GOOGLE_STT_CREDENTIALS", "VOICE_TTS_PROVIDER", "VOICE_STT_YO"]) {
    delete process.env[k];
  }
}

function agentIn(language: string, extra: Partial<Agent["config"]["voice"]> = {}): Agent {
  return {
    config: { voice: { provider: "elevenlabs", voiceId: "", language, speed: 1, kind: "provider", providerVoiceId: "voixElevenLabs1", ...extra } },
  } as unknown as Agent;
}

describe("registre des langues", () => {
  it("une langue « disponible » a au moins une transcription ET une voix ; une langue « bientôt » n'est jamais proposée", () => {
    for (const l of VOICE_LANGUAGES) {
      if (l.status === "disponible") {
        expect(l.stt.length, l.id).toBeGreaterThan(0);
        expect(l.tts.length, l.id).toBeGreaterThan(0);
      } else {
        expect(isSelectableLanguage(l.id, new Set([l.id])), l.id).toBe(false);
      }
    }
  });

  it("le fon n'est pas encore possible, même activé", () => {
    expect(isSelectableLanguage("fon-BJ", new Set(["fon-BJ"]))).toBe(false);
    expect(isRejectedLanguage("fon-BJ", new Set(["fon-BJ"]))).toBe(true);
  });

  it("une langue locale disponible reste fermée tant que le fondateur ne l'a pas activée", () => {
    expect(isSelectableLanguage("yo-NG", new Set())).toBe(false);
    expect(isSelectableLanguage("yo-NG", new Set(["yo-NG", "ha-NG"]))).toBe(true);
    expect(isSelectableLanguage("fr-FR", new Set())).toBe(true);
  });

  it("l'API refuse une langue locale non disponible, mais accepte toujours les identifiants hors registre", () => {
    delete process.env.NEXT_PUBLIC_VOICE_LOCAL_LANGUAGES;
    expect(languageField.safeParse("fon-BJ").success).toBe(false);
    expect(languageField.safeParse("yo-NG").success).toBe(false);
    expect(languageField.safeParse("fr-FR").success).toBe(true);
    expect(languageField.safeParse("en-US").success).toBe(true);
  });

  it("mode bilingue imposé quand Claude est faible dans la langue", () => {
    expect(bilingualRequired("wo-SN")).toBe(true);
    expect(bilingualRequired("yo-NG")).toBe(false);
    expect(bilingualRequired("fr-FR")).toBe(false);
  });

  it("codes de langue propres à chaque fournisseur", () => {
    expect(sttLanguageCode("yo-NG", "google")).toBe("yo-NG");
    expect(sttLanguageCode("yo-NG", "elevenlabs")).toBe("yor");
    expect(providerLanguageCode("yo-NG", "elevenlabs")).toBe("yo");
    expect(providerLanguageCode("fr-FR", "elevenlabs")).toBe("fr");
  });
});

describe("choix du fournisseur de transcription", () => {
  it("le français reste sur Deepgram", () => {
    clearKeys();
    process.env.DEEPGRAM_API_KEY = "x";
    process.env.ELEVENLABS_API_KEY = "x";
    expect(sttProviderFor("fr-FR")).toBe("deepgram");
  });

  it("une langue locale prend le premier fournisseur dont la clé existe, jamais Deepgram", () => {
    clearKeys();
    process.env.DEEPGRAM_API_KEY = "x";
    expect(sttProviderFor("yo-NG")).toBeNull();
    process.env.SPITCH_API_KEY = "x";
    expect(sttProviderFor("yo-NG")).toBe("spitch");
    process.env.ELEVENLABS_API_KEY = "x";
    expect(sttProviderFor("yo-NG")).toBe("elevenlabs");
    process.env.VOICE_STT_YO = "spitch";
    expect(sttProviderFor("yo-NG")).toBe("spitch");
  });

  it("Spitch ne transcrit pas le wolof", () => {
    clearKeys();
    process.env.SPITCH_API_KEY = "x";
    expect(sttProviderFor("wo-SN")).toBeNull();
  });

  it("mode bilingue : ElevenLabs Scribe sans langue imposée", async () => {
    clearKeys();
    process.env.ELEVENLABS_API_KEY = "x";
    expect(sttProviderFor("yo-NG", true)).toBe("elevenlabs");
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ text: "Bonjour, ẹ káàárọ̀" })));
    vi.stubGlobal("fetch", fetchMock);
    const text = await batchTranscriber("elevenlabs", "yo-NG", true)(wavFromPcm16(new Int16Array(800)), new AbortController().signal);
    expect(text).toBe("Bonjour, ẹ káàárọ̀");
    const form = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as FormData;
    expect(form.get("model_id")).toBe("scribe_v2");
    expect(form.get("language_code")).toBeNull();
  });

  it("Spitch reçoit la phrase en WAV avec le code de langue", async () => {
    process.env.SPITCH_API_KEY = "k";
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ text: "ẹ ṣé" })));
    vi.stubGlobal("fetch", fetchMock);
    await batchTranscriber("spitch", "yo-NG")(wavFromPcm16(new Int16Array(800)), new AbortController().signal);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.spitch.app/v1/transcriptions");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer k");
    expect((init.body as FormData).get("language")).toBe("yo");
  });
});

describe("choix de la voix", () => {
  it("le français garde ElevenLabs Flash et la voix choisie", () => {
    clearKeys();
    process.env.ELEVENLABS_API_KEY = "x";
    process.env.SPITCH_API_KEY = "x";
    const v = resolveVoice(agentIn("fr-FR"));
    expect(v).toMatchObject({ provider: "elevenlabs", voiceId: "voixElevenLabs1", model: "eleven_flash_v2_5" });
  });

  it("yoruba : Spitch en premier, avec une voix yoruba", () => {
    clearKeys();
    process.env.ELEVENLABS_API_KEY = "x";
    process.env.SPITCH_API_KEY = "x";
    expect(resolveVoice(agentIn("yo-NG"))).toMatchObject({ provider: "spitch", voiceId: "sade" });
  });

  it("yoruba sans Spitch : ElevenLabs avec un modèle qui parle yoruba (Flash ne le parle pas)", () => {
    clearKeys();
    process.env.ELEVENLABS_API_KEY = "x";
    expect(resolveVoice(agentIn("yo-NG"))).toMatchObject({ provider: "elevenlabs", model: "eleven_v3", voiceId: "voixElevenLabs1" });
    expect(elevenLabsModel("wo-SN")).toBe("eleven_v4_turbo");
  });

  it("mode bilingue : jamais Spitch (il ne parle pas français), langue déduite du texte", () => {
    clearKeys();
    process.env.ELEVENLABS_API_KEY = "x";
    process.env.SPITCH_API_KEY = "x";
    expect(ttsProviderFor("yo-NG", true)).toBe("elevenlabs");
    expect(resolveVoice(agentIn("yo-NG", { bilingual: true }))).toMatchObject({ provider: "elevenlabs", autoLanguage: true });
  });

  it("langue locale sans aucune clé : pas de voix (l'appel échoue proprement)", () => {
    clearKeys();
    process.env.CARTESIA_API_KEY = "x";
    expect(resolveVoice(agentIn("ha-NG"))).toBeNull();
  });
});

describe("conversion WAV en flux -> µ-law 8 kHz (Spitch)", () => {
  it("lit l'en-tête coupé en morceaux et convertit 16 kHz en 8 kHz", () => {
    const pcm = new Int16Array(1600).fill(4000); // 100 ms à 16 kHz
    const wav = wavFromPcm16(pcm, 16000);
    const t = new WavToMulaw();
    const out = Buffer.concat([t.push(wav.subarray(0, 20)), t.push(wav.subarray(20, 47)), t.push(wav.subarray(47))]);
    expect(t.started).toBe(true);
    expect(out.length).toBe(800); // 100 ms à 8 kHz
    expect(out[400]).toBe(encodeMulaw(new Int16Array([4000]))[0]);
  });

  it("refuse une réponse qui n'est pas un WAV", () => {
    expect(() => new WavToMulaw().push(Buffer.from("<html>erreur passerelle</html>"))).toThrow();
  });
});

describe("coût réel selon le fournisseur", () => {
  it("Spitch est facturé à la seconde d'audio, Scribe à la minute d'appel", () => {
    delete process.env.ELEVENLABS_USD_PER_1K_CHARS;
    const m = new CostMeter();
    m.setProviders("elevenlabs", "spitch");
    m.addTtsAudio(8000 * 30); // 30 s de voix
    const c = m.summary({ durationSec: 60, direction: "web", to: "" });
    expect(c.usd.tts).toBeCloseTo(30 * 0.0014, 6);
    expect(c.usd.stt).toBeCloseTo(0.22 / 60, 6);
    expect(c.units).toMatchObject({ ttsAudioSec: 30, sttProvider: "elevenlabs", ttsProvider: "spitch" });
  });

  it("Eleven v3 coûte deux fois Flash au caractère", () => {
    delete process.env.ELEVENLABS_USD_PER_1K_CHARS;
    const m = new CostMeter();
    m.addTts("a".repeat(1000), "eleven_v3");
    m.addTts("a".repeat(1000), "eleven_flash_v2_5");
    expect(m.summary({ durationSec: 0, direction: "web", to: "" }).usd.tts).toBeCloseTo(0.12, 6);
  });
});

describe("consignes de langue dans le prompt", () => {
  it("rien pour le français", () => {
    expect(languageInstructions("fr-FR")).toBe("");
  });

  it("yoruba : répondre en yoruba, avec les tons", () => {
    const p = languageInstructions("yo-NG");
    expect(p).toContain("Réponds toujours en yoruba");
    expect(p).toContain("tons");
  });

  it("yoruba bilingue : suivre la langue de l'appelant", () => {
    expect(languageInstructions("yo-NG", true)).toContain("Réponds dans la langue de la dernière phrase de l'appelant");
  });

  it("wolof (Claude faible) : français, formules locales sûres seulement", () => {
    const p = languageInstructions("wo-SN");
    expect(p).toContain("Réponds en français");
    expect(p).toContain("n'invente jamais");
  });
});

describe("cas relevés en revue", () => {
  it("agent wolof créé sans le champ bilingual : le mode bilingue s'applique quand même", () => {
    clearKeys();
    process.env.ELEVENLABS_API_KEY = "x";
    expect(resolveVoice(agentIn("wo-SN"))).toMatchObject({ provider: "elevenlabs", autoLanguage: true });
    expect(effectiveBilingual("wo-SN", undefined)).toBe(true);
    expect(effectiveBilingual("fr-FR", true)).toBe(false);
  });

  it("WAV 22 050 Hz en petits morceaux : pas de dérive de durée", () => {
    const pcm = new Int16Array(22050).fill(2000); // 1 s
    const wav = wavFromPcm16(pcm, 22050);
    const t = new WavToMulaw();
    let total = 0;
    for (let i = 0; i < wav.length; i += 333) total += t.push(wav.subarray(i, i + 333)).length;
    expect(Math.abs(total - 8000)).toBeLessThanOrEqual(2);
  });

  it("ce qui suit le bloc audio du WAV n'est pas joué", () => {
    const wav = wavFromPcm16(new Int16Array(800), 8000); // 100 ms
    const trailer = Buffer.concat([Buffer.from("LIST"), Buffer.from([8, 0, 0, 0]), Buffer.alloc(8, 0x41)]);
    const out = new WavToMulaw().push(Buffer.concat([wav, trailer]));
    expect(out.length).toBe(800);
  });

  it("jeton Google : compte de service en base64, mis en cache", async () => {
    const { generateKeyPairSync } = await import("node:crypto");
    const { googleAccessToken, resetGoogleTokenCache } = await import("@/lib/voice-engine/google-auth");
    const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const sa = { client_email: "stt@projet.iam.gserviceaccount.com", private_key: privateKey.export({ type: "pkcs8", format: "pem" }).toString(), project_id: "projet" };
    process.env.GOOGLE_STT_CREDENTIALS = Buffer.from(JSON.stringify(sa)).toString("base64");
    resetGoogleTokenCache();
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ access_token: "jeton", expires_in: 3600 })));
    vi.stubGlobal("fetch", fetchMock);
    expect(await googleAccessToken()).toBe("jeton");
    expect(await googleAccessToken()).toBe("jeton");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as URLSearchParams;
    expect(body.get("assertion")?.split(".")).toHaveLength(3);
    resetGoogleTokenCache();
  });
});
