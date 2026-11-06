/**
 * Champs à extraire en fin d'appel — définitions et validation (fonctions
 * pures, importables côté client, testées).
 *
 * Chaque agent peut déclarer les informations à relever dans chaque appel
 * (« budget », « motif », « date souhaitée »…). Le LLM les extrait de la
 * transcription ; on ne garde que des valeurs conformes au type déclaré.
 */

export type ExtractFieldType = "text" | "number" | "boolean" | "choice" | "date";

export interface ExtractField {
  /** Clé technique (snake_case), utilisée dans l'API et les webhooks. */
  key: string;
  /** Libellé affiché. */
  label: string;
  type: ExtractFieldType;
  /** Ce que le champ signifie, pour guider l'extraction. */
  description?: string;
  /** Valeurs autorisées (type « choice »). */
  options?: string[];
}

export interface AnalysisConfig {
  /** Informations à relever. */
  fields: ExtractField[];
  /** Ce qui fait qu'un appel est réussi (sert au score de réussite). */
  successCriteria?: string;
}

export type ExtractedData = Record<string, string | number | boolean | null>;

export const MAX_FIELDS = 15;

/** Clé technique sûre à partir d'un libellé (« Date souhaitée » -> date_souhaitee). */
export function fieldKey(label: string): string {
  return (
    label
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 40) || "champ"
  );
}

/** Description lisible du schéma, injectée dans la consigne d'analyse. */
export function describeFields(fields: ExtractField[]): string {
  return fields
    .slice(0, MAX_FIELDS)
    .map((f) => {
      const type =
        f.type === "number"
          ? "nombre"
          : f.type === "boolean"
            ? "true/false"
            : f.type === "date"
              ? "date AAAA-MM-JJ"
              : f.type === "choice"
                ? `une valeur parmi : ${(f.options ?? []).map((o) => JSON.stringify(o)).join(", ")}`
                : "texte court";
      return `- "${f.key}" (${type}) : ${f.label}${f.description ? ` — ${f.description}` : ""}`;
    })
    .join("\n");
}

function asNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const cleaned = v.replace(/\s/g, "").replace(",", ".").replace(/[^\d.-]/g, "");
    // « beaucoup » ne doit pas devenir 0 : il faut au moins un chiffre.
    if (!/\d/.test(cleaned)) return null;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function asBoolean(v: unknown): boolean | null {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (["true", "oui", "yes", "vrai", "1"].includes(s)) return true;
    if (["false", "non", "no", "faux", "0"].includes(s)) return false;
  }
  return null;
}

function asDate(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const m = v.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCMonth() === +m[2] - 1 ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

/**
 * Ne garde que les valeurs conformes au schéma. Valeur absente, inventée ou
 * mal typée : null (on préfère « non renseigné » à une donnée fausse).
 */
export function coerceExtracted(fields: ExtractField[], raw: unknown): ExtractedData {
  const src = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const out: ExtractedData = {};
  for (const f of fields.slice(0, MAX_FIELDS)) {
    const v = src[f.key];
    if (v === undefined || v === null || v === "") {
      out[f.key] = null;
      continue;
    }
    switch (f.type) {
      case "number":
        out[f.key] = asNumber(v);
        break;
      case "boolean":
        out[f.key] = asBoolean(v);
        break;
      case "date":
        out[f.key] = asDate(v);
        break;
      case "choice": {
        const s = String(v).trim().toLowerCase();
        out[f.key] = (f.options ?? []).find((o) => o.toLowerCase() === s) ?? null;
        break;
      }
      default:
        out[f.key] = String(v).replace(/\s+/g, " ").trim().slice(0, 300) || null;
    }
  }
  return out;
}

/** Valeur lisible (tableaux, exports). */
export function formatValue(v: string | number | boolean | null | undefined): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "Oui" : "Non";
  if (typeof v === "number") return v.toLocaleString("fr-FR");
  return v;
}
