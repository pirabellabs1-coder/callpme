/**
 * Évaluation heuristique d'un appel — score de réussite, atteinte de
 * l'objectif, sentiment. (Sera remplacée par une évaluation LLM en prod.)
 */
import type { TranscriptTurn } from "../shared/types";

export interface EvalResult {
  successScore: number; // 0..100
  goalAchieved: boolean;
  sentiment: "positive" | "neutral" | "negative";
  summary: string;
}

export function evaluateCall(
  transcript: TranscriptTurn[],
  durationSec: number,
): EvalResult {
  const text = transcript.map((t) => t.text).join(" ").toLowerCase();
  const exchanges = transcript.filter((t) => t.speaker === "caller").length;
  const tools = transcript.filter((t) => t.speaker === "tool").length;
  const positive = (
    text.match(/merci|parfait|oui|d'accord|intéress|rendez-vous|super|bien sûr|nickel/g) ||
    []
  ).length;
  const negative = (
    text.match(/pas intéress|plus tard|probl[èe]me|m[ée]content|raccroch|non merci/g) || []
  ).length;

  let score =
    45 + exchanges * 8 + tools * 6 + positive * 5 - negative * 8 + (durationSec > 30 ? 10 : 0);
  score = Math.max(5, Math.min(98, score));

  const goalAchieved = score >= 60 && (exchanges >= 1 || tools >= 1);
  const sentiment: EvalResult["sentiment"] =
    positive > negative + 1 ? "positive" : negative > positive ? "negative" : "neutral";
  const summary = goalAchieved
    ? "L'agent a mené l'échange à son terme et traité la demande."
    : "Échange court ou objectif non atteint.";

  return { successScore: Math.round(score), goalAchieved, sentiment, summary };
}
