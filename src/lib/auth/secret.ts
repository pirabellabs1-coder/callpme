/**
 * Secret de signature HMAC (cookies admin, jetons de réinitialisation).
 * En production, NEXTAUTH_SECRET est obligatoire (≥ 32 caractères) : sans lui,
 * les jetons seraient forgeables. En développement, une valeur locale est
 * utilisée avec un avertissement. Lu à l'appel (et non au chargement du module)
 * pour ne pas casser `next build`.
 */
const DEV_SECRET = "callpme-dev-only-secret-not-for-production";
let warned = false;

export function getAuthSecret(): string {
  const s = process.env.NEXTAUTH_SECRET;
  if (s && s.length >= 32) return s;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "NEXTAUTH_SECRET manquant ou trop court (32 caractères minimum) en production.",
    );
  }
  if (!warned) {
    warned = true;
    console.warn("[auth] NEXTAUTH_SECRET absent : secret de développement utilisé.");
  }
  return DEV_SECRET;
}
