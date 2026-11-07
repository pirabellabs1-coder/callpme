/**
 * Compteur du coût réel d'un appel : ce que l'appel a vraiment consommé
 * (tokens, caractères de voix, durée), multiplié par les prix des fournisseurs.
 */
import type { LlmUsage } from "../llm/usage";
import {
  llmPrice,
  outboundUsdPerMinute,
  SPITCH_TTS_USD_PER_SEC,
  sttUsdPerMinuteFor,
  ttsUsdPer1kChars,
  TWILIO_INBOUND_FR,
  TWILIO_MEDIA_STREAMS,
  usdToEur,
} from "./prices";

export interface CallCosts {
  /** Ce que l'appel a consommé. */
  units: {
    durationSec: number;
    llmCalls: number;
    inputTokens: number;
    outputTokens: number;
    cacheWriteTokens: number;
    cacheReadTokens: number;
    ttsChars: number;
    /** Secondes de voix facturées à la durée (Spitch). */
    ttsAudioSec?: number;
    /** Fournisseurs de transcription et de voix utilisés. */
    sttProvider?: string;
    ttsProvider?: string;
    models: string[];
  };
  /** Coût par poste, en dollars. */
  usd: { llm: number; tts: number; stt: number; telephony: number; total: number };
  /** Coût total en euros (taux usdToEur). */
  eur: number;
  usdToEur: number;
}

const r6 = (n: number) => Math.round(n * 1e6) / 1e6;

export class CostMeter {
  private llm: LlmUsage[] = [];
  private ttsChars = 0;
  private ttsUsd = 0;
  private ttsAudioSec = 0;
  private sttProvider: string | undefined;
  private ttsProvider: string | undefined;

  /** Fournisseurs de l'appel (selon la langue de l'agent). */
  setProviders(stt: string | undefined, tts: string | undefined) {
    this.sttProvider = stt;
    this.ttsProvider = tts;
  }

  addLlm(u: LlmUsage) {
    this.llm.push(u);
  }

  /** Voix facturée au caractère (ElevenLabs, Cartesia), au prix du modèle utilisé. */
  addTts(text: string, model?: string) {
    this.ttsChars += text.length;
    this.ttsUsd += (text.length / 1000) * ttsUsdPer1kChars(model);
  }

  /** Voix facturée à la seconde d'audio produit (Spitch) : `mulawBytes` à 8 000 octets par seconde. */
  addTtsAudio(mulawBytes: number) {
    const sec = mulawBytes / 8000;
    this.ttsAudioSec += sec;
    this.ttsUsd += sec * SPITCH_TTS_USD_PER_SEC;
  }

  summary(opts: { durationSec: number; direction: "inbound" | "outbound" | "web"; to: string }): CallCosts {
    const min = Math.max(0, opts.durationSec) / 60;
    let llmUsd = 0;
    const t = { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 };
    for (const u of this.llm) {
      const p = llmPrice(u.model);
      llmUsd += (u.input * p.input + u.output * p.output + u.cacheWrite * p.cacheWrite + u.cacheRead * p.cacheRead) / 1e6;
      t.input += u.input;
      t.output += u.output;
      t.cacheWrite += u.cacheWrite;
      t.cacheRead += u.cacheRead;
    }
    const tts = this.ttsUsd;
    const stt = min * sttUsdPerMinuteFor(this.sttProvider);
    // Facturation téléphonique à la minute entamée.
    const billedMin = Math.ceil(min);
    const telephony =
      opts.direction === "web"
        ? 0
        : billedMin * ((opts.direction === "outbound" ? outboundUsdPerMinute(opts.to) : TWILIO_INBOUND_FR) + TWILIO_MEDIA_STREAMS);
    const total = llmUsd + tts + stt + telephony;
    const rate = usdToEur();
    return {
      units: {
        durationSec: Math.round(opts.durationSec),
        llmCalls: this.llm.length,
        inputTokens: t.input,
        outputTokens: t.output,
        cacheWriteTokens: t.cacheWrite,
        cacheReadTokens: t.cacheRead,
        ttsChars: this.ttsChars,
        ...(this.ttsAudioSec ? { ttsAudioSec: Math.round(this.ttsAudioSec * 10) / 10 } : {}),
        ...(this.sttProvider ? { sttProvider: this.sttProvider } : {}),
        ...(this.ttsProvider ? { ttsProvider: this.ttsProvider } : {}),
        models: Array.from(new Set(this.llm.map((u) => u.model))),
      },
      usd: { llm: r6(llmUsd), tts: r6(tts), stt: r6(stt), telephony: r6(telephony), total: r6(total) },
      eur: r6(total * rate),
      usdToEur: rate,
    };
  }
}

export function parseCosts(raw: string | null | undefined): CallCosts | null {
  if (!raw) return null;
  try {
    const c = JSON.parse(raw) as CallCosts;
    return typeof c?.eur === "number" && c.usd && c.units ? c : null;
  } catch {
    return null;
  }
}
