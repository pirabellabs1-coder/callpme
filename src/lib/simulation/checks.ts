/**
 * Vérifications d'un test par simulation — fonctions pures (testées),
 * importables côté client.
 */
import type { TranscriptTurn } from "../shared/types";

export interface Expectations {
  /** Outils que l'agent doit avoir appelés (ex. bookAppointment). */
  mustCallTools?: string[];
  /** Outils interdits dans ce scénario (ex. transferToHuman). */
  mustNotCallTools?: string[];
  /** Mots ou expressions que l'agent doit avoir dits. */
  mustSay?: string[];
  /** Mots ou expressions que l'agent ne doit jamais dire. */
  mustNotSay?: string[];
  /** Critère libre jugé par l'IA (ex. « reste poli malgré l'agressivité »). */
  judge?: string;
}

export interface CheckResult {
  label: string;
  passed: boolean;
  detail?: string;
}

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ");

export function parseExpectations(raw: string | null | undefined): Expectations {
  try {
    const v = JSON.parse(raw ?? "{}");
    const list = (x: unknown) =>
      Array.isArray(x) ? x.filter((i): i is string => typeof i === "string" && i.trim().length > 0).slice(0, 20) : [];
    return {
      mustCallTools: list(v.mustCallTools),
      mustNotCallTools: list(v.mustNotCallTools),
      mustSay: list(v.mustSay),
      mustNotSay: list(v.mustNotSay),
      judge: typeof v.judge === "string" && v.judge.trim() ? v.judge.trim().slice(0, 600) : undefined,
    };
  } catch {
    return {};
  }
}

/** Vérifications déterministes (sans IA) sur la transcription simulée. */
export function ruleChecks(transcript: TranscriptTurn[], e: Expectations): CheckResult[] {
  const used = new Set(transcript.filter((t) => t.speaker === "tool").map((t) => t.toolName ?? ""));
  const said = norm(transcript.filter((t) => t.speaker === "agent").map((t) => t.text).join(" "));
  const out: CheckResult[] = [];
  for (const tool of e.mustCallTools ?? []) {
    out.push({ label: `Appelle l'outil « ${tool} »`, passed: used.has(tool) });
  }
  for (const tool of e.mustNotCallTools ?? []) {
    out.push({ label: `N'appelle pas « ${tool} »`, passed: !used.has(tool) });
  }
  for (const phrase of e.mustSay ?? []) {
    out.push({ label: `Dit « ${phrase} »`, passed: said.includes(norm(phrase)) });
  }
  for (const phrase of e.mustNotSay ?? []) {
    const hit = said.includes(norm(phrase));
    out.push({ label: `Ne dit jamais « ${phrase} »`, passed: !hit, detail: hit ? "Formulation trouvée dans les réponses." : undefined });
  }
  return out;
}

/** Résultat global : réussi si toutes les vérifications passent. */
export function summarizeChecks(checks: CheckResult[]): { passed: boolean; score: number } {
  if (checks.length === 0) return { passed: true, score: 100 };
  const ok = checks.filter((c) => c.passed).length;
  return { passed: ok === checks.length, score: Math.round((ok / checks.length) * 100) };
}

/** Répliques d'un scénario « script » (une par ligne, lignes vides ignorées). */
export function scriptLines(callerPrompt: string): string[] {
  return callerPrompt
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(appelant|client|caller)\s*:\s*/i, "").trim())
    .filter(Boolean)
    .slice(0, 20);
}
