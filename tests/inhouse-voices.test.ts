import { afterEach, describe, expect, it, vi } from "vitest";
import { floatToPcm16, pcm16ToWav, sniffAudio, wavInfo } from "@/lib/voices/inhouse/audio-format";
import {
  canTransition,
  checkClip,
  CLIP_LIMITS,
  consentValid,
  formatDuration,
  isActiveJob,
  isBaseModel,
  MODEL_REF_RE,
  modelRefForJob,
  trainingBlocker,
  TRAINING_MINIMUM,
} from "@/lib/voices/inhouse/rules";
import { sniffConsentDocument } from "@/lib/voices/inhouse/http";
import { callpmeSpeechRequest, callpmeTtsConfigured, callpmeTtsUrl } from "@/lib/voice-engine/callpme-tts";
import { resolveVoice, streamSpeech, usesInhouseVoice } from "@/lib/voice-engine/tts";
import { voiceSchema } from "@/lib/validation/agent";
import type { Agent } from "@/lib/shared/types";

const env = { ...process.env };
afterEach(() => {
  process.env = { ...env };
  vi.unstubAllGlobals();
});

const setEnv = (vars: Record<string, string | undefined>) => {
  for (const [k, v] of Object.entries(vars)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
};

function agentWith(voice: Partial<Agent["config"]["voice"]>): Agent {
  return {
    config: { voice: { provider: "elevenlabs", voiceId: "", language: "fr-FR", speed: 1, ...voice } },
  } as unknown as Agent;
}

/* ------------------------------ Formats audio ------------------------------ */

describe("formats audio des clips", () => {
  it("reconnaît le format réel par les octets, pas par le nom", () => {
    const wav = pcm16ToWav(new Int16Array(16000), 16000);
    expect(sniffAudio(wav)).toBe("audio/wav");
    expect(sniffAudio(new TextEncoder().encode("fLaC...."))).toBe("audio/flac");
    expect(sniffAudio(new TextEncoder().encode("OggS...."))).toBe("audio/ogg");
    expect(sniffAudio(new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0]))).toBe("audio/webm");
    expect(sniffAudio(new TextEncoder().encode("ID3\x03"))).toBe("audio/mpeg");
    expect(sniffAudio(new TextEncoder().encode("<html>"))).toBeNull();
    expect(sniffAudio(new TextEncoder().encode("%PDF-1.7"))).toBeNull();
  });

  it("lit la durée et le format d'un WAV produit par l'enregistreur", () => {
    const wav = pcm16ToWav(new Int16Array(24000 * 3), 24000); // 3 s à 24 kHz
    expect(wavInfo(wav)).toEqual({ channels: 1, sampleRate: 24000, bitsPerSample: 16, durationMs: 3000 });
  });

  it("borne la durée d'un WAV dont l'en-tête annonce trop de données", () => {
    const wav = pcm16ToWav(new Int16Array(8000), 8000); // 1 s
    new DataView(wav.buffer).setUint32(40, 0xfffffff0, true);
    expect(wavInfo(wav)?.durationMs).toBe(1000);
  });

  it("refuse un faux WAV", () => {
    expect(wavInfo(new TextEncoder().encode("RIFF\0\0\0\0WAVEjunk"))).toBeNull();
    expect(wavInfo(new Uint8Array(4))).toBeNull();
  });

  it("convertit le flottant Web Audio en PCM 16 bits sans débordement", () => {
    expect(Array.from(floatToPcm16(new Float32Array([0, 1, -1, 2, -2])))).toEqual([0, 32767, -32768, 32767, -32768]);
  });
});

/* ------------------------------ Clips et consentement ------------------------------ */

describe("validation d'un clip", () => {
  const wav = { channels: 1, sampleRate: 24000, durationMs: 4000 };
  const base = { attested: true, transcript: "  Bonjour,   bienvenue chez Callpme. ", mime: "audio/wav", wav, declaredMs: null };

  it("accepte un clip attesté et normalise la transcription", () => {
    expect(checkClip(base)).toEqual({ transcript: "Bonjour, bienvenue chez Callpme.", mime: "audio/wav", durationMs: 4000 });
  });

  it("exige l'attestation de consentement pour chaque clip", () => {
    expect(checkClip({ ...base, attested: false })).toHaveProperty("error");
  });

  it("refuse un format inconnu, un WAV stéréo ou trop pauvre", () => {
    expect(checkClip({ ...base, mime: null })).toHaveProperty("error");
    expect(checkClip({ ...base, wav: { ...wav, channels: 2 } })).toHaveProperty("error");
    expect(checkClip({ ...base, wav: { ...wav, sampleRate: 8000 } })).toHaveProperty("error");
  });

  it("borne la durée et la transcription", () => {
    expect(checkClip({ ...base, wav: { ...wav, durationMs: CLIP_LIMITS.minMs - 1 } })).toHaveProperty("error");
    expect(checkClip({ ...base, wav: { ...wav, durationMs: CLIP_LIMITS.maxMs + 1 } })).toHaveProperty("error");
    expect(checkClip({ ...base, transcript: "a" })).toHaveProperty("error");
    expect(checkClip({ ...base, transcript: "a".repeat(CLIP_LIMITS.transcriptMax + 1) })).toHaveProperty("error");
  });

  it("pour un format compressé, prend la durée mesurée par le navigateur", () => {
    expect(checkClip({ ...base, mime: "audio/webm", wav: null, declaredMs: 5200.4 })).toMatchObject({ durationMs: 5200 });
    expect(checkClip({ ...base, mime: "audio/webm", wav: null, declaredMs: null })).toHaveProperty("error");
  });

  it("la durée lue dans le WAV prime sur celle déclarée", () => {
    expect(checkClip({ ...base, declaredMs: 29_000 })).toMatchObject({ durationMs: 4000 });
  });

  it("reconnaît les documents de consentement acceptés", () => {
    expect(sniffConsentDocument(new TextEncoder().encode("%PDF-1.4"))).toBe("application/pdf");
    expect(sniffConsentDocument(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(sniffConsentDocument(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png");
    expect(sniffConsentDocument(new TextEncoder().encode("<svg>"))).toBeNull();
  });

  it("un consentement révoqué n'est plus valide", () => {
    expect(consentValid({ revokedAt: null })).toBe(true);
    expect(consentValid({ revokedAt: new Date() })).toBe(false);
    expect(consentValid(null)).toBe(false);
  });
});

/* ------------------------------ Entraînement ------------------------------ */

describe("entraînement", () => {
  const enough = { clips: TRAINING_MINIMUM.clips, durationMs: TRAINING_MINIMUM.durationMs };

  it("refuse sans consentement, avec un entraînement actif ou un jeu trop petit", () => {
    expect(trainingBlocker({ consent: null, dataset: enough, hasActiveJob: false })).toMatch(/Consentement/);
    expect(trainingBlocker({ consent: { revokedAt: new Date() }, dataset: enough, hasActiveJob: false })).toMatch(/Consentement/);
    expect(trainingBlocker({ consent: { revokedAt: null }, dataset: enough, hasActiveJob: true })).toMatch(/déjà/);
    expect(trainingBlocker({ consent: { revokedAt: null }, dataset: { ...enough, clips: 3 }, hasActiveJob: false })).toMatch(/trop petit/);
    expect(trainingBlocker({ consent: { revokedAt: null }, dataset: { ...enough, durationMs: 60_000 }, hasActiveJob: false })).toMatch(/trop petit/);
  });

  it("autorise avec consentement valide et jeu suffisant", () => {
    expect(trainingBlocker({ consent: { revokedAt: null }, dataset: enough, hasActiveJob: false })).toBeNull();
  });

  it("fige les états finaux et suit le cycle de vie", () => {
    expect(canTransition("queued", "submitted")).toBe(true);
    expect(canTransition("submitted", "running")).toBe(true);
    expect(canTransition("running", "running")).toBe(true); // progression
    expect(canTransition("running", "succeeded")).toBe(true);
    expect(canTransition("succeeded", "running")).toBe(false);
    expect(canTransition("canceled", "succeeded")).toBe(false);
    expect(canTransition("failed", "queued")).toBe(false);
    expect(canTransition("inconnu", "running")).toBe(false);
    expect(isActiveJob("running")).toBe(true);
    expect(isActiveJob("succeeded")).toBe(false);
  });

  it("ne propose que des modèles de base à licence commerciale", () => {
    expect(isBaseModel("orpheus-fr")).toBe(true);
    expect(isBaseModel("xtts-v2")).toBe(false); // Coqui Public Model License : non commercial
    expect(isBaseModel("f5-tts")).toBe(false); // poids CC-BY-NC
  });

  it("l'identifiant du modèle est utilisable comme voix d'agent", () => {
    const ref = modelRefForJob("clx1234567890abcdefghijk");
    expect(ref).toBe("cpm_clx1234567890abcdefghijk");
    expect(MODEL_REF_RE.test(ref)).toBe(true);
    expect(voiceSchema.safeParse({ provider: "callpme", voiceId: "", language: "fr-FR", speed: 1, kind: "provider", providerVoiceId: ref }).success).toBe(true);
  });

  it("affiche des durées lisibles", () => {
    expect(formatDuration(45_000)).toBe("45 s");
    expect(formatDuration(725_000)).toBe("12 min 05 s");
    expect(formatDuration(3_900_000)).toBe("1 h 05 min");
  });
});

/* ------------------------------ Fournisseur « callpme » ------------------------------ */

describe("fournisseur TTS callpme (serveur d'inférence maison)", () => {
  it("reste inactif sans CALLPME_TTS_URL", () => {
    setEnv({ CALLPME_TTS_URL: undefined });
    expect(callpmeTtsConfigured()).toBe(false);
    expect(() => callpmeSpeechRequest({ text: "x", modelRef: "cpm_abcdef", language: "fr-FR" })).toThrow(/non configuré/);
  });

  it("refuse une URL invalide et le http public en production", () => {
    setEnv({ CALLPME_TTS_URL: "ftp://voix.example.com" });
    expect(callpmeTtsUrl()).toBeNull();
    setEnv({ CALLPME_TTS_URL: "pas une url" });
    expect(callpmeTtsUrl()).toBeNull();
    setEnv({ CALLPME_TTS_URL: "http://voix.example.com", NODE_ENV: "production" });
    expect(callpmeTtsUrl()).toBeNull();
    setEnv({ CALLPME_TTS_URL: "http://callpme-tts.internal:8000/", NODE_ENV: "production" });
    expect(callpmeTtsUrl()).toBe("http://callpme-tts.internal:8000");
    setEnv({ CALLPME_TTS_URL: "https://tts.callpme.com/" });
    expect(callpmeTtsUrl()).toBe("https://tts.callpme.com");
  });

  it("construit la requête de synthèse en flux µ-law 8 kHz", () => {
    setEnv({ CALLPME_TTS_URL: "https://tts.callpme.com", CALLPME_TTS_API_KEY: "cle-de-test" });
    const { url, init } = callpmeSpeechRequest({ text: "Bonjour", modelRef: "cpm_abcdef", language: "fr-FR", speed: 3 });
    expect(url).toBe("https://tts.callpme.com/v1/tts/stream");
    expect(init.headers.Authorization).toBe("Bearer cle-de-test");
    expect(JSON.parse(init.body)).toEqual({ text: "Bonjour", voice: "cpm_abcdef", language: "fr", speed: 1.5, format: "ulaw_8000" });
  });

  it("sans clé, n'envoie pas d'en-tête Authorization", () => {
    setEnv({ CALLPME_TTS_URL: "https://tts.callpme.com", CALLPME_TTS_API_KEY: undefined });
    expect(callpmeSpeechRequest({ text: "x", modelRef: "cpm_abcdef", language: "fr" }).init.headers.Authorization).toBeUndefined();
  });

  const inhouseAgent = () => agentWith({ provider: "callpme", kind: "provider", providerVoiceId: "cpm_voixawa01" });

  it("utilise la voix maison publiée quand le serveur est configuré", () => {
    setEnv({ CALLPME_TTS_URL: "https://tts.callpme.com", ELEVENLABS_API_KEY: "x" });
    expect(usesInhouseVoice(inhouseAgent())).toBe(true);
    expect(resolveVoice(inhouseAgent(), "voixCatalogue", null, true)).toMatchObject({ provider: "callpme", voiceId: "cpm_voixawa01" });
  });

  it("sans serveur configuré, ElevenLabs reste la voix par défaut", () => {
    setEnv({ CALLPME_TTS_URL: undefined, ELEVENLABS_API_KEY: "x" });
    expect(resolveVoice(inhouseAgent(), "voixCatalogue", null, true)).toMatchObject({ provider: "elevenlabs", voiceId: "voixCatalogue" });
  });

  it("voix maison retirée ou consentement révoqué : retombe sur le catalogue", () => {
    setEnv({ CALLPME_TTS_URL: "https://tts.callpme.com", ELEVENLABS_API_KEY: "x" });
    expect(resolveVoice(inhouseAgent(), "voixCatalogue", null, false)).toMatchObject({ provider: "elevenlabs", voiceId: "voixCatalogue" });
  });

  it("les agents ElevenLabs ne sont pas affectés par le serveur maison", () => {
    setEnv({ CALLPME_TTS_URL: "https://tts.callpme.com", ELEVENLABS_API_KEY: "x" });
    const v = resolveVoice(agentWith({ kind: "provider", providerVoiceId: "voixChoisie1" }), "voixCatalogue", null, true);
    expect(v).toMatchObject({ provider: "elevenlabs", voiceId: "voixChoisie1" });
  });

  it("diffuse l'audio du serveur maison au fil de l'eau", async () => {
    setEnv({ CALLPME_TTS_URL: "https://tts.callpme.com" });
    const calls: string[] = [];
    vi.stubGlobal("fetch", async (url: string, init: { body: string }) => {
      calls.push(url);
      expect(JSON.parse(init.body).voice).toBe("cpm_voixawa01");
      const body = new ReadableStream({
        start(c) {
          c.enqueue(new Uint8Array([1, 2, 3]));
          c.enqueue(new Uint8Array([4, 5]));
          c.close();
        },
      });
      return new Response(body, { status: 200 });
    });
    const chunks: Buffer[] = [];
    const voice = { provider: "callpme" as const, voiceId: "cpm_voixawa01", language: "fr-FR" };
    for await (const c of streamSpeech("Bonjour", voice, new AbortController().signal)) chunks.push(c);
    expect(calls).toEqual(["https://tts.callpme.com/v1/tts/stream"]);
    expect(Buffer.concat(chunks)).toEqual(Buffer.from([1, 2, 3, 4, 5]));
  });

  it("signale clairement un refus du serveur maison", async () => {
    setEnv({ CALLPME_TTS_URL: "https://tts.callpme.com" });
    vi.stubGlobal("fetch", async () => new Response("down", { status: 503 }));
    const voice = { provider: "callpme" as const, voiceId: "cpm_voixawa01", language: "fr-FR" };
    const it = streamSpeech("Bonjour", voice, new AbortController().signal);
    await expect(it.next()).rejects.toThrow(/callpme, HTTP 503/);
  });
});

/* ------------------------------ Worker d'entraînement ------------------------------ */

describe("authentification du serveur d'entraînement", () => {
  it("refuse tout sans secret suffisamment long", async () => {
    const { workerAuthorized, trainingConfigured } = await import("@/lib/voices/inhouse/worker");
    setEnv({ CALLPME_TRAINING_SECRET: "court", CALLPME_TRAINING_URL: "https://gpu.example.com" });
    expect(workerAuthorized("Bearer court")).toBe(false);
    expect(trainingConfigured()).toBe(false);
  });

  it("n'accepte que le bon jeton Bearer", async () => {
    const { workerAuthorized, trainingConfigured } = await import("@/lib/voices/inhouse/worker");
    const secret = "s".repeat(40);
    setEnv({ CALLPME_TRAINING_SECRET: secret, CALLPME_TRAINING_URL: "https://gpu.example.com" });
    expect(trainingConfigured()).toBe(true);
    expect(workerAuthorized(`Bearer ${secret}`)).toBe(true);
    expect(workerAuthorized(`Bearer ${secret}x`)).toBe(false);
    expect(workerAuthorized(secret)).toBe(false);
    expect(workerAuthorized(null)).toBe(false);
  });

  it("valide les rapports d'avancement", async () => {
    const { statusReportSchema } = await import("@/lib/voices/inhouse/worker");
    expect(statusReportSchema.safeParse({ status: "running", progress: 40 }).success).toBe(true);
    expect(statusReportSchema.safeParse({ status: "running", progress: 140 }).success).toBe(false);
    expect(statusReportSchema.safeParse({ status: "queued" }).success).toBe(false);
  });
});
