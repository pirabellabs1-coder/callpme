/**
 * Nettoyage du texte AVANT synthèse vocale.
 *
 * Objectif : l'agent ne doit JAMAIS prononcer à voix haute des variables non
 * résolues ({{nom}}, [ENTREPRISE]…), du markdown ou des éléments techniques —
 * c'est incompréhensible pour l'auditeur. On substitue les variables connues
 * (nom de l'agent, organisation) et on retire proprement le reste.
 */

export interface SpeechVars {
  agentName?: string;
  organizationName?: string;
}

const AGENT_KEYS = ["agent", "agentname", "agent_name", "nom", "name", "assistant"];
const ORG_KEYS = [
  "org",
  "organisation",
  "organization",
  "organizationname",
  "company",
  "companyname",
  "entreprise",
  "société",
  "societe",
  "brand",
  "marque",
];

/** Remplace une variable {{clef}} par sa valeur connue, sinon chaîne vide. */
function resolveVar(raw: string, vars: SpeechVars): string {
  const key = raw.trim().toLowerCase().replace(/[\s_-]/g, "");
  if (AGENT_KEYS.includes(key) && vars.agentName) return vars.agentName;
  if (ORG_KEYS.includes(key) && vars.organizationName) return vars.organizationName;
  return "";
}

export function sanitizeSpoken(text: string, vars: SpeechVars = {}): string {
  if (!text) return "";
  let out = text;

  // {{ variable }} et {variable} → valeur connue ou suppression.
  out = out.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_m, name) => resolveVar(String(name), vars));
  out = out.replace(/\{\s*([^}]+?)\s*\}/g, (_m, name) => resolveVar(String(name), vars));

  // [NOM], [ENTREPRISE], [variable_x] : placeholders entre crochets.
  out = out.replace(/\[\s*([A-Za-zÀ-ÿ0-9 _-]{1,40})\s*\]/g, (m, name) => {
    const v = resolveVar(String(name), vars);
    // Si ça ressemble à un placeholder (un seul mot / MAJ / underscore), on retire.
    const looksLikeVar = /^[A-ZÀ-Ÿ0-9_]+$/.test(String(name).trim()) || /_/.test(String(name));
    return v || (looksLikeVar ? "" : m);
  });

  // Markdown / symboles parlés inutilement.
  out = out
    .replace(/[*_`#>]+/g, " ")
    .replace(/\s*\|\s*/g, " ")
    .replace(/^\s*[-•]\s+/gm, "");

  // Espaces et ponctuation résiduels.
  out = out
    .replace(/\(\s*\)/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/([,;:])\1+/g, "$1")
    .trim();

  return out;
}
