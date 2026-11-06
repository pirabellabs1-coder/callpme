/**
 * Relevé de consommation des modèles de langage (tokens), pour mesurer le coût
 * réel de chaque appel. Le moteur vocal ouvre une « portée » autour du travail
 * d'un appel ; chaque requête au modèle y déclare ses tokens.
 */
import { AsyncLocalStorage } from "async_hooks";

export interface LlmUsage {
  model: string;
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
}

type Sink = (u: LlmUsage) => void;
const scope = new AsyncLocalStorage<Sink>();

/** Exécute `fn` en relevant toute la consommation des modèles dans `sink`. */
export function runWithUsage<T>(sink: Sink, fn: () => Promise<T>): Promise<T> {
  return scope.run(sink, fn);
}

export function reportLlmUsage(u: LlmUsage) {
  const sink = scope.getStore();
  if (!sink) return;
  try {
    sink(u);
  } catch {
    /* le relevé ne doit jamais casser une réponse */
  }
}

/** Tokens d'une réponse Anthropic (champ `usage`). */
export function anthropicUsage(model: string, u: Record<string, unknown> | undefined): LlmUsage | null {
  if (!u) return null;
  const n = (k: string) => (typeof u[k] === "number" ? (u[k] as number) : 0);
  return { model, input: n("input_tokens"), output: n("output_tokens"), cacheWrite: n("cache_creation_input_tokens"), cacheRead: n("cache_read_input_tokens") };
}
