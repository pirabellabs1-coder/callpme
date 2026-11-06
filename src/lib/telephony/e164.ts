/** Normalise un numéro au format E.164 (best-effort, défaut France). */
export function toE164(raw: string): string | null {
  let s = (raw || "").replace(/[^\d+]/g, "");
  if (!s) return null;
  if (s.startsWith("00")) s = "+" + s.slice(2);
  if (!s.startsWith("+")) {
    if (s.startsWith("0") && s.length === 10) s = "+33" + s.slice(1);
    else s = "+" + s;
  }
  return /^\+\d{8,15}$/.test(s) ? s : null;
}
