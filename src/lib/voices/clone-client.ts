/**
 * Client (navigateur) du serveur de clonage vocal LOCAL et auto-hébergé.
 * Aucun service externe : on appelle le serveur que l'utilisateur fait tourner
 * sur sa propre machine (voir /voice-clone-server). Le navigateur a le droit
 * d'appeler http://localhost même depuis une page https.
 */
const KEY = "callpme_clone_url";
const DEFAULT_URL = "http://localhost:8000";

export function getCloneUrl(): string {
  if (typeof window === "undefined") return DEFAULT_URL;
  return localStorage.getItem(KEY) || DEFAULT_URL;
}

export function setCloneUrl(url: string): void {
  if (typeof window !== "undefined") localStorage.setItem(KEY, url.trim());
}

function base(): string {
  return getCloneUrl().replace(/\/+$/, "");
}

export interface CloneHealth {
  ok: boolean;
  loaded: boolean;
  error: string | null;
}

/** Vérifie que le serveur local répond, et si le modèle est prêt. */
export async function cloneHealth(): Promise<CloneHealth> {
  try {
    const res = await fetch(`${base()}/health`, {
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return { ok: false, loaded: false, error: `HTTP ${res.status}` };
    const j = await res.json();
    return { ok: true, loaded: Boolean(j.loaded), error: j.error ?? null };
  } catch {
    return { ok: false, loaded: false, error: "injoignable" };
  }
}

/**
 * Génère l'audio de `text` AVEC la voix de `sampleUrl` (enregistrement Studio).
 * Renvoie une object-URL audio à lire, ou une erreur lisible expliquant le repli.
 */
export async function cloneSpeak(
  text: string,
  sampleUrl: string,
  language: string,
): Promise<{ url: string | null; error: string }> {
  try {
    const res = await fetch(`${base()}/clone`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: text.slice(0, 600), sample: sampleUrl, language }),
      signal: AbortSignal.timeout(120000),
    });
    if (!res.ok) {
      let detail = `erreur serveur (${res.status})`;
      try {
        const j = await res.json();
        if (j?.detail) detail = String(j.detail);
      } catch {
        /* pas de corps JSON */
      }
      return { url: null, error: detail };
    }
    const blob = await res.blob();
    return { url: URL.createObjectURL(blob), error: "" };
  } catch (e) {
    const msg =
      e instanceof Error && e.name === "TimeoutError"
        ? "délai dépassé (modèle lent — réessaie)"
        : "serveur de clonage injoignable";
    return { url: null, error: msg };
  }
}
