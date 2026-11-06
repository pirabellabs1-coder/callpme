/**
 * Session d'appel du moteur vocal Callpme — indépendante du transport
 * (téléphone Twilio/Telnyx ou test navigateur).
 *
 * Boucle : audio entrant -> STT (Deepgram) -> fin de tour -> cerveau de l'agent
 * (LLM + RAG + outils) -> TTS en streaming (ElevenLabs/Cartesia) -> audio sortant.
 *
 * - Interruption (« barge-in ») : si l'appelant parle pendant que l'agent
 *   parle, la synthèse est coupée et l'audio en attente est vidé.
 * - Outils : endCall raccroche après la dernière phrase ; transferToHuman
 *   transfère vers le numéro configuré de l'agent quand l'opérateur le permet.
 * - Garde-fous : durée maximale, silence prolongé, quota contrôlé en amont.
 * - Fin : l'appel est enregistré (transcription, résumé, webhook).
 */
import { getAgentById } from "../db/agents";
import { prisma } from "../db/client";
import { sanitizeSpoken } from "../voice/speech-text";
import type { CallStatus, TranscriptTurn } from "../shared/types";
import type { Agent } from "../shared/types";
import { agentReply, type Turn } from "./brain";
import { openDeepgram, type SttStream } from "./stt";
import { resolveVoice, streamSpeech, type TtsVoice } from "./tts";
import { finishCall } from "./persist";
import type { VoiceTokenPayload } from "./token";

/** Ce que le transport doit savoir faire. */
export interface VoiceTransport {
  /** Envoie de l'audio µ-law 8 kHz à l'appelant. */
  sendAudio(mulaw: Buffer): void;
  /** Vide l'audio pas encore joué (interruption). */
  clearAudio(): void;
  /** Raccroche / ferme le flux. */
  hangup(): void;
  /** Événements facultatifs pour l'interface (test navigateur). */
  sendEvent?(event: { type: string; [k: string]: unknown }): void;
  /** Transfère l'appel vers un numéro (téléphone uniquement). */
  transfer?(toNumber: string): Promise<boolean>;
}

const VOICE_STYLE =
  "## Style oral\nTu parles au téléphone : phrases courtes, une idée à la fois, pas de listes, " +
  "pas de markdown, pas d'émojis. Annonce que tu es un assistant IA si on te le demande.";

const SILENCE_HANGUP_MS = 30_000;

export class CallSession {
  private agent!: Agent;
  private organizationName = "";
  private voice: TtsVoice | null = null;
  private stt: SttStream | null = null;
  private history: Turn[] = [];
  private transcript: TranscriptTurn[] = [];
  private readonly startedAt = Date.now();
  private userBuffer = "";
  private busy = false;
  private speaking: AbortController | null = null;
  /** Instant (ms) où l'audio déjà envoyé aura fini d'être joué. */
  private playbackUntil = 0;
  private lastActivity = Date.now();
  private ended = false;
  private status: CallStatus = "completed";
  private hangupAfterSpeech = false;
  private timers: NodeJS.Timeout[] = [];
  private providerCallId: string | null = null;

  constructor(
    private readonly ctx: VoiceTokenPayload,
    private readonly transport: VoiceTransport,
  ) {}

  setProviderCallId(id: string | null | undefined) {
    if (id) this.providerCallId = id;
  }

  /** Charge l'agent, ouvre la transcription et prononce l'accueil. */
  async start(): Promise<void> {
    const agent = await getAgentById(this.ctx.agentId);
    if (!agent || agent.organizationId !== this.ctx.organizationId) {
      this.transport.sendEvent?.({ type: "error", message: "Agent introuvable." });
      return this.transport.hangup();
    }
    this.agent = agent;
    const org = await prisma.organization.findUnique({ where: { id: agent.organizationId }, select: { name: true } });
    this.organizationName = org?.name ?? "";
    this.voice = resolveVoice(agent);
    if (!this.voice) {
      this.transport.sendEvent?.({ type: "error", message: "Aucune voix configurée pour le moteur vocal." });
      return this.end("failed");
    }

    this.stt = openDeepgram(agent.config.voice.language || "fr-FR", {
      onSpeechStarted: () => this.onCallerSpeech(),
      onTranscript: (text, isFinal) => this.onTranscript(text, isFinal),
      onUtteranceEnd: () => void this.onUtteranceEnd(),
      onError: () => this.transport.sendEvent?.({ type: "error", message: "Transcription interrompue." }),
    });

    const max = agent.config.maxDurationSec && agent.config.maxDurationSec > 0 ? agent.config.maxDurationSec : 1800;
    this.timers.push(setTimeout(() => void this.end("completed"), Math.min(max, 3600) * 1000));
    this.timers.push(
      setInterval(() => {
        const idle = Date.now() - Math.max(this.lastActivity, this.playbackUntil);
        if (!this.busy && idle > SILENCE_HANGUP_MS) void this.end(this.hasCallerSpoken() ? "completed" : "missed");
      }, 5000),
    );

    if ((agent.config.firstSpeaker ?? "agent") === "agent") {
      const greeting =
        sanitizeSpoken(agent.config.firstMessage, { agentName: agent.name, organizationName: this.organizationName }) ||
        "Bonjour, comment puis-je vous aider ?";
      this.history.push({ role: "assistant", content: greeting });
      this.addTurn("agent", greeting);
      await this.speak(greeting);
    }
  }

  /** Audio de l'appelant (µ-law 8 kHz). */
  onAudio(mulaw: Buffer) {
    if (!this.ended) this.stt?.send(mulaw);
  }

  /** Le transport s'est fermé (raccroché côté appelant). */
  async onTransportClosed() {
    await this.end(this.status);
  }

  /* ----------------------------- Écoute ----------------------------- */

  private isAgentAudible() {
    return this.speaking !== null || Date.now() < this.playbackUntil;
  }

  /** Coupe l'agent quand l'appelant prend la parole. */
  private interrupt() {
    if (!this.isAgentAudible()) return;
    this.speaking?.abort();
    this.speaking = null;
    this.playbackUntil = 0;
    this.transport.clearAudio();
    this.transport.sendEvent?.({ type: "interrupted" });
  }

  private onCallerSpeech() {
    this.lastActivity = Date.now();
  }

  private onTranscript(text: string, isFinal: boolean) {
    this.lastActivity = Date.now();
    // Interruption seulement sur des mots réels (évite les bruits et l'écho).
    if (this.isAgentAudible() && text.split(/\s+/).filter(Boolean).length >= 2) this.interrupt();
    this.transport.sendEvent?.({ type: "transcript", speaker: "caller", text, final: isFinal });
    if (isFinal) this.userBuffer = `${this.userBuffer} ${text}`.trim();
  }

  private async onUtteranceEnd() {
    if (this.busy || this.ended) return;
    const text = this.userBuffer.trim();
    if (!text) return;
    this.userBuffer = "";
    this.busy = true;
    try {
      this.history.push({ role: "user", content: text });
      this.addTurn("caller", text);
      await this.respond();
    } finally {
      this.busy = false;
    }
    // Phrase arrivée pendant la réflexion : on y répond aussi.
    if (this.userBuffer.trim() && !this.ended) void this.onUtteranceEnd();
  }

  /* ---------------------------- Réflexion ---------------------------- */

  private async respond() {
    this.transport.sendEvent?.({ type: "thinking" });
    let reply = "";
    try {
      const result = await agentReply(
        {
          agent: this.agent,
          organizationId: this.agent.organizationId,
          callId: this.ctx.callId,
          callerNumber: this.ctx.direction === "outbound" ? this.ctx.to : this.ctx.from,
          extraInstructions: VOICE_STYLE,
        },
        this.history,
      );
      reply = result.text;
      for (const call of result.toolCalls) {
        this.addTurn("tool", call.message, call.name);
        if (call.name === "endCall") this.hangupAfterSpeech = true;
        if (call.name === "transferToHuman") await this.transferToHuman();
      }
    } catch {
      reply = "Je suis désolé, je rencontre un problème technique. Pouvez-vous répéter ?";
    }
    const spoken = sanitizeSpoken(reply, { agentName: this.agent.name, organizationName: this.organizationName });
    if (spoken) {
      this.history.push({ role: "assistant", content: spoken });
      this.addTurn("agent", spoken);
      await this.speak(spoken);
    }
    if (this.hangupAfterSpeech) {
      // Laisse la dernière phrase se terminer avant de raccrocher.
      const wait = Math.max(0, this.playbackUntil - Date.now()) + 400;
      this.timers.push(setTimeout(() => void this.end(this.status), wait));
    }
  }

  private async transferToHuman() {
    const number = this.agent.config.transferNumber;
    if (!number || !this.transport.transfer || !this.providerCallId) return;
    // Annonce courte, puis transfert une fois la phrase jouée.
    await this.speak("Je vous mets en relation avec un conseiller, ne quittez pas.");
    const wait = Math.max(0, this.playbackUntil - Date.now()) + 300;
    await new Promise((r) => setTimeout(r, wait));
    const ok = await this.transport.transfer(number);
    if (ok) {
      this.status = "transferred";
      await this.end("transferred", { keepLine: true });
    }
  }

  /* ------------------------------ Parole ------------------------------ */

  private async speak(text: string) {
    if (!this.voice || this.ended) return;
    const ctrl = new AbortController();
    this.speaking?.abort();
    this.speaking = ctrl;
    this.transport.sendEvent?.({ type: "speaking", text });
    try {
      for await (const chunk of streamSpeech(text, this.voice, ctrl.signal)) {
        if (ctrl.signal.aborted || this.ended) break;
        this.transport.sendAudio(chunk);
        // 8 000 octets µ-law = 1 seconde d'audio.
        this.playbackUntil = Math.max(this.playbackUntil, Date.now()) + (chunk.length / 8000) * 1000;
      }
    } catch (e) {
      if (!ctrl.signal.aborted) {
        this.transport.sendEvent?.({ type: "error", message: e instanceof Error ? e.message : "Synthèse vocale impossible." });
      }
    } finally {
      if (this.speaking === ctrl) this.speaking = null;
      this.lastActivity = Date.now();
    }
  }

  /* ------------------------------- Fin ------------------------------- */

  private addTurn(speaker: TranscriptTurn["speaker"], text: string, toolName?: string) {
    const turn: TranscriptTurn = {
      speaker,
      text,
      at: Math.round((Date.now() - this.startedAt) / 100) / 10,
      ...(toolName ? { toolName } : {}),
    };
    this.transcript.push(turn);
    if (speaker !== "caller") this.transport.sendEvent?.({ type: "turn", turn });
  }

  private hasCallerSpoken() {
    return this.transcript.some((t) => t.speaker === "caller");
  }

  async end(status: CallStatus, opts: { keepLine?: boolean } = {}) {
    if (this.ended) return;
    this.ended = true;
    this.speaking?.abort();
    this.timers.forEach((t) => clearTimeout(t));
    this.stt?.close();
    if (!opts.keepLine) this.transport.hangup();
    if (!this.agent) return;
    try {
      const call = await finishCall({
        agent: this.agent,
        organizationId: this.agent.organizationId,
        direction: this.ctx.direction,
        from: this.ctx.from,
        to: this.ctx.to,
        startedAt: this.startedAt,
        transcript: this.transcript,
        status: this.hasCallerSpoken() || status === "transferred" ? status : "missed",
        metadata: this.ctx.metadata,
        providerCallId: this.providerCallId,
      });
      this.transport.sendEvent?.({ type: "ended", callId: call.id });
    } catch {
      this.transport.sendEvent?.({ type: "error", message: "L'appel n'a pas pu être enregistré." });
    }
  }
}
