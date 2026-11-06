import { getCountry } from "../geo/countries";

/**
 * Normalise un numéro au format E.164. Un numéro saisi sans indicatif est lu
 * selon le pays de l'organisation (`country`, code ISO ; France par défaut) :
 * au Bénin « 01 97 12 34 56 » donne +2290197123456, en France +33197123456.
 */
export function toE164(raw: string, country?: string | null): string | null {
  // « +33 (0)6 12… » : le (0) national est retiré.
  let s = (raw || "").replace(/\(\s*0\s*\)/g, "").replace(/[^\d+]/g, "");
  if (!s) return null;
  if (s.startsWith("00")) s = "+" + s.slice(2);
  if (!s.startsWith("+")) {
    const national = getCountry(country).national(s);
    s = national ? `+${national}` : `+${s}`;
  }
  return /^\+\d{8,15}$/.test(s) ? s : null;
}
