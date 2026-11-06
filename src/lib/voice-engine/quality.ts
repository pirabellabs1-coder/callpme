/**
 * Qualité technique d'un appel : temps de réponse de l'agent, interruptions,
 * pannes du modèle ou de la voix. Calculé pendant l'appel, enregistré avec lui.
 *
 * « Temps de réponse » = de la fin de la phrase de l'appelant au premier son
 * de l'agent (ce que l'appelant perçoit comme un blanc).
 */

export interface CallQuality {
  /** Tours où l'agent a répondu après une phrase de l'appelant. */
  turns: number;
  /** Temps de réponse perçu (ms). */
  responseAvgMs: number | null;
  responseP95Ms: number | null;
  /** Délai du modèle jusqu'à son premier mot (ms). */
  llmAvgMs: number | null;
  /** Délai de la voix : du premier mot du modèle au premier son (ms). */
  ttsAvgMs: number | null;
  interruptions: number;
  llmErrors: number;
  ttsErrors: number;
  /** Problèmes détectés, en clair (vide si l'appel s'est bien passé). */
  issues: string[];
}

/** Au-delà, un blanc devient gênant au téléphone. */
export const SLOW_RESPONSE_MS = 2500;

interface TurnTiming {
  start: number;
  llm: number | null;
  audio: number | null;
}

function percentile(sorted: number[], p: number): number {
  const i = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[i];
}

function avg(values: number[]): number | null {
  if (!values.length) return null;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

export class QualityTracker {
  private turns: TurnTiming[] = [];
  private current: TurnTiming | null = null;
  private interruptions = 0;
  private llmErrors = 0;
  private ttsErrors = 0;

  constructor(private readonly now: () => number = Date.now) {}

  /** L'appelant a fini sa phrase : le chronomètre démarre. */
  turnStart() {
    this.current = { start: this.now(), llm: null, audio: null };
    this.turns.push(this.current);
  }

  /** Premier mot produit par le modèle pour ce tour. */
  llmFirstToken() {
    if (this.current && this.current.llm === null) this.current.llm = this.now() - this.current.start;
  }

  /** Premier son envoyé à l'appelant pour ce tour. */
  firstAudio() {
    if (this.current && this.current.audio === null) {
      this.current.audio = this.now() - this.current.start;
      // Réponse non diffusée en flux : le premier mot arrive avec le premier son.
      if (this.current.llm === null) this.current.llm = this.current.audio;
    }
  }

  /** Fin du tour (la suite de l'audio n'est plus du temps de réponse). */
  turnEnd() {
    this.current = null;
  }

  interrupted() {
    this.interruptions++;
  }

  llmError() {
    this.llmErrors++;
  }

  ttsError() {
    this.ttsErrors++;
  }

  summary(): CallQuality {
    const answered = this.turns.filter((t) => t.audio !== null);
    const response = answered.map((t) => t.audio as number).sort((a, b) => a - b);
    const llm = answered.map((t) => t.llm as number);
    const tts = answered.map((t) => Math.max(0, (t.audio as number) - (t.llm as number)));
    const responseP95Ms = response.length ? percentile(response, 95) : null;
    const responseAvgMs = avg(response);

    const issues: string[] = [];
    if (responseAvgMs !== null && responseAvgMs > SLOW_RESPONSE_MS) {
      issues.push(`Réponses lentes : ${(responseAvgMs / 1000).toFixed(1).replace(".", ",")} s en moyenne.`);
    } else if (responseP95Ms !== null && responseP95Ms > SLOW_RESPONSE_MS * 1.6) {
      issues.push(`Au moins un long blanc : ${(responseP95Ms / 1000).toFixed(1).replace(".", ",")} s avant de répondre.`);
    }
    if (this.llmErrors) issues.push(`Le modèle n'a pas répondu ${this.llmErrors} fois.`);
    if (this.ttsErrors) issues.push(`La voix a échoué ${this.ttsErrors} fois.`);
    if (this.turns.length >= 4 && this.interruptions / this.turns.length > 0.5) {
      issues.push("L'appelant coupe souvent l'agent : réponses peut-être trop longues.");
    }

    return {
      turns: answered.length,
      responseAvgMs,
      responseP95Ms,
      llmAvgMs: avg(llm),
      ttsAvgMs: avg(tts),
      interruptions: this.interruptions,
      llmErrors: this.llmErrors,
      ttsErrors: this.ttsErrors,
      issues,
    };
  }
}

/** Lecture tolérante de la colonne `Call.quality` (JSON). */
export function parseQuality(raw: string | null | undefined): CallQuality | null {
  if (!raw) return null;
  try {
    const q = JSON.parse(raw) as CallQuality;
    return typeof q === "object" && q && typeof q.turns === "number" ? { ...q, issues: Array.isArray(q.issues) ? q.issues : [] } : null;
  } catch {
    return null;
  }
}
