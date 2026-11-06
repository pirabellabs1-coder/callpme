/**
 * Compteur du coût réel d'un appel : ce que l'appel a vraiment consommé
 * (tokens, caractères de voix, durée), multiplié par les prix des fournisseurs.
 */
import type { LlmUsage } from "../llm/usage";
import {
  llmPrice,
  outboundUsdPerMinute,
  sttUsdPerMinute,
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

  addLlm(u: LlmUsage) {
    this.llm.push(u);
  }

  addTts(text: string) {
    this.ttsChars += text.length;
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
    const tts = (this.ttsChars / 1000) * ttsUsdPer1kChars();
    const stt = min * sttUsdPerMinute();
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
