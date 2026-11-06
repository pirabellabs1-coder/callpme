import { beforeEach, describe, expect, it, vi } from "vitest";

/* ---------------- Simulations des services externes ---------------- */

const stt = vi.hoisted(() => ({
  events: null as null | {
    onSpeechStarted?: () => void;
    onTranscript?: (t: string, f: boolean) => void;
    onUtteranceEnd?: () => void;
  },
  sent: [] as Buffer[],
  closed: false,
}));
vi.mock("@/lib/voice-engine/stt", () => ({
  openDeepgram: (_lang: string, events: typeof stt.events) => {
    stt.events = events;
    return { send: (b: Buffer) => stt.sent.push(b), close: () => (stt.closed = true) };
  },
  sttConfigured: () => true,
}));

const tts = vi.hoisted(() => ({ spoken: [] as string[], slow: false }));
vi.mock("@/lib/voice-engine/tts", () => ({
  resolveVoice: () => ({ provider: "elevenlabs", voiceId: "v", language: "fr-FR" }),
  ttsConfigured: () => true,
  async *streamSpeech(text: string, _v: unknown, signal: AbortSignal) {
    tts.spoken.push(text);
    for (let i = 0; i < 4; i++) {
      if (signal.aborted) return;
      if (tts.slow) await new Promise((r) => setTimeout(r, 20));
      yield Buffer.alloc(800, 0xff); // 100 ms de silence µ-law
    }
  },
}));

const brain = vi.hoisted(() => ({
  reply: "Bien sûr, jeudi à 16 h vous convient ?",
  toolCalls: [] as { name: string; arguments: Record<string, unknown>; message: string }[],
  histories: [] as unknown[],
}));
vi.mock("@/lib/voice-engine/brain", () => ({
  agentReply: async (_ctx: unknown, history: unknown[]) => {
    brain.histories.push([...history]);
    return { text: brain.reply, toolCalls: brain.toolCalls, prepared: {} };
  },
}));

const persisted = vi.hoisted(() => ({ calls: [] as Record<string, unknown>[] }));
vi.mock("@/lib/voice-engine/persist", () => ({
  finishCall: async (input: Record<string, unknown>) => {
    persisted.calls.push(input);
    return { id: "call_test" };
  },
}));

vi.mock("@/lib/db/agents", () => ({
  getAgentById: async (id: string) => ({
    id,
    organizationId: "org_1",
    name: "Léa",
    role: "appointment",
    status: "active",
    config: {
      voice: { provider: "elevenlabs", voiceId: "lea", language: "fr-FR", speed: 1 },
      model: { provider: "anthropic", modelId: "x", temperature: 0.5 },
      systemPrompt: "Tu es l'assistante.",
      firstMessage: "Cabinet Diallo, bonjour.",
      firstSpeaker: "agent",
      guardrails: [],
      tools: ["endCall"],
      transferNumber: "+33123456789",
    },
  }),
}));
const org = vi.hoisted(() => ({ delayMs: 0 }));
vi.mock("@/lib/db/client", () => ({
  prisma: {
    organization: {
      findUnique: async () => {
        if (org.delayMs) await new Promise((r) => setTimeout(r, org.delayMs));
        return { name: "Cabinet Diallo", plan: "pro" };
      },
    },
  },
}));
const quota = vi.hoisted(() => ({ minutes: 500 }));
vi.mock("@/lib/billing/limits", () => ({ remainingMinutes: async () => quota.minutes }));

import { CallSession, type VoiceTransport } from "@/lib/voice-engine/session";

function makeTransport() {
  const t = {
    audio: [] as Buffer[],
    clears: 0,
    hungUp: false,
    transfers: [] as string[],
    events: [] as { type: string }[],
  };
  const transport: VoiceTransport = {
    sendAudio: (b) => t.audio.push(b),
    clearAudio: () => t.clears++,
    hangup: () => (t.hungUp = true),
    sendEvent: (e) => t.events.push(e),
    transfer: async (n) => {
      t.transfers.push(n);
      return true;
    },
  };
  return { t, transport };
}

const ctx = {
  callId: "c1",
  agentId: "agt_1",
  organizationId: "org_1",
  direction: "inbound" as const,
  from: "+33600000000",
  to: "+33100000000",
  jti: "test",
  exp: Date.now() + 60_000,
};

const tick = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  stt.events = null;
  stt.sent = [];
  stt.closed = false;
  tts.spoken = [];
  tts.slow = false;
  brain.reply = "Bien sûr, jeudi à 16 h vous convient ?";
  brain.toolCalls = [];
  brain.histories = [];
  persisted.calls = [];
  org.delayMs = 0;
  quota.minutes = 500;
});

describe("CallSession (moteur vocal)", () => {
  it("prononce l'accueil puis répond à l'appelant", async () => {
    const { t, transport } = makeTransport();
    const s = new CallSession(ctx, transport);
    await s.start();
    expect(tts.spoken[0]).toBe("Cabinet Diallo, bonjour.");
    expect(t.audio.length).toBeGreaterThan(0);

    stt.events!.onTranscript!("Je voudrais un rendez-vous", true);
    await stt.events!.onUtteranceEnd!();
    await tick();
    // Le texte est nettoyé avant synthèse (typographie normalisée pour la voix).
    expect(tts.spoken[1]).toContain("jeudi à 16 h vous convient");
    // L'historique transmis au cerveau contient l'accueil et la demande.
    // L'appelant a parlé pendant l'accueil : le cerveau sait qu'il a été coupé.
    expect(brain.histories[0]).toEqual([
      { role: "assistant", content: "Cabinet Diallo, bonjour. [interrompu par l'appelant]" },
      { role: "user", content: "Je voudrais un rendez-vous" },
    ]);
    await s.end("completed");
  });

  it("transmet l'audio de l'appelant à la transcription", async () => {
    const { transport } = makeTransport();
    const s = new CallSession(ctx, transport);
    await s.start();
    s.onAudio(Buffer.alloc(160, 0x7f));
    expect(stt.sent.length).toBe(1);
    await s.end("completed");
  });

  it("s'interrompt quand l'appelant parle par-dessus", async () => {
    tts.slow = true;
    const { t, transport } = makeTransport();
    const s = new CallSession(ctx, transport);
    const started = s.start();
    await new Promise((r) => setTimeout(r, 30)); // l'agent est en train de parler
    stt.events!.onTranscript!("attendez une seconde", false);
    await started;
    expect(t.clears).toBeGreaterThan(0);
    expect(t.events.some((e) => e.type === "interrupted")).toBe(true);
    await s.end("completed");
  });

  it("raccroche après endCall et enregistre l'appel", async () => {
    brain.reply = "Merci, au revoir.";
    brain.toolCalls = [{ name: "endCall", arguments: {}, message: "Appel terminé." }];
    const { t, transport } = makeTransport();
    const s = new CallSession(ctx, transport);
    await s.start();
    stt.events!.onTranscript!("C'est tout, merci", true);
    await stt.events!.onUtteranceEnd!();
    await new Promise((r) => setTimeout(r, 900));
    expect(t.hungUp).toBe(true);
    expect(stt.closed).toBe(true);
    expect(persisted.calls).toHaveLength(1);
    const saved = persisted.calls[0] as { status: string; transcript: { speaker: string }[] };
    expect(saved.status).toBe("completed");
    expect(saved.transcript.map((x) => x.speaker)).toEqual(["agent", "caller", "tool", "agent"]);
  });

  it("transfère vers le numéro de l'agent quand un humain est demandé", async () => {
    brain.reply = "";
    brain.toolCalls = [{ name: "transferToHuman", arguments: {}, message: "Transfert." }];
    const { t, transport } = makeTransport();
    const s = new CallSession(ctx, transport);
    s.setProviderCallId("CA123");
    await s.start();
    stt.events!.onTranscript!("Je veux parler à quelqu'un", true);
    await stt.events!.onUtteranceEnd!();
    await new Promise((r) => setTimeout(r, 900));
    expect(t.transfers).toEqual(["+33123456789"]);
    expect((persisted.calls[0] as { status: string }).status).toBe("transferred");
  });

  it("marque l'appel « manqué » si l'appelant n'a jamais parlé", async () => {
    const { transport } = makeTransport();
    const s = new CallSession(ctx, transport);
    await s.start();
    await s.end("completed");
    expect((persisted.calls[0] as { status: string }).status).toBe("missed");
  });

  it("n'ouvre rien si l'appelant raccroche pendant le démarrage", async () => {
    org.delayMs = 30;
    const { transport } = makeTransport();
    const s = new CallSession(ctx, transport);
    const started = s.start();
    await s.onTransportClosed();
    await started;
    expect(stt.events).toBeNull(); // aucune transcription ouverte
    expect(tts.spoken).toHaveLength(0);
  });

  it("enregistre « transferred » si l'opérateur coupe le flux pendant le transfert", async () => {
    brain.reply = "";
    brain.toolCalls = [{ name: "transferToHuman", arguments: {}, message: "Transfert." }];
    const { t, transport } = makeTransport();
    let closeDuring: (() => Promise<void>) | null = null;
    transport.transfer = async (n) => {
      t.transfers.push(n);
      await closeDuring!(); // le flux se ferme avant la réponse de l'API
      return true;
    };
    const s = new CallSession(ctx, transport);
    closeDuring = () => s.onTransportClosed();
    s.setProviderCallId("CA123");
    await s.start();
    stt.events!.onTranscript!("Un conseiller s'il vous plaît", true);
    await stt.events!.onUtteranceEnd!();
    await new Promise((r) => setTimeout(r, 900));
    expect(persisted.calls).toHaveLength(1);
    expect((persisted.calls[0] as { status: string }).status).toBe("transferred");
  });

  it("n'annonce pas de transfert impossible (test navigateur, sans opérateur)", async () => {
    brain.reply = "Je vous transfère.";
    brain.toolCalls = [{ name: "transferToHuman", arguments: {}, message: "Transfert." }];
    const { t, transport } = makeTransport();
    const s = new CallSession(ctx, transport); // pas d'identifiant d'appel opérateur
    await s.start();
    stt.events!.onTranscript!("Je veux un humain", true);
    await stt.events!.onUtteranceEnd!();
    await tick();
    expect(t.transfers).toHaveLength(0);
    expect(tts.spoken[1]).toContain("recontactera");
    await s.end("completed");
  });

  it("ne répond pas à une phrase encore en cours après la réflexion", async () => {
    const { transport } = makeTransport();
    const s = new CallSession(ctx, transport);
    await s.start();
    stt.events!.onTranscript!("Je voudrais", true);
    const first = stt.events!.onUtteranceEnd!();
    // Pendant la réflexion, un morceau arrive sans fin de tour.
    stt.events!.onTranscript!("déplacer mon", true);
    await first;
    await tick();
    expect(brain.histories).toHaveLength(1);
    // La fin de tour suivante déclenche la réponse au reste de la phrase.
    stt.events!.onTranscript!("rendez-vous", true);
    await stt.events!.onUtteranceEnd!();
    await tick();
    expect(brain.histories).toHaveLength(2);
    await s.end("completed");
  });

  it("refuse l'appel quand le quota de minutes est épuisé", async () => {
    quota.minutes = 0;
    const { t, transport } = makeTransport();
    const s = new CallSession(ctx, transport);
    await s.start();
    expect(t.hungUp).toBe(true);
    expect(tts.spoken).toHaveLength(0);
  });
});
