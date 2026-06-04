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

/** Vérifie que le serveur local répond. */
export async function cloneHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${base()}/health`, {
      signal: AbortSignal.timeout(4000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Génère l'audio de `text` AVEC la voix de `sampleUrl` (enregistrement Studio).
 * Renvoie une object-URL audio à lire, ou null si le serveur est indisponible.
 */
export async function cloneSpeak(
  text: string,
  sampleUrl: string,
  language: string,
): Promise<string | null> {
  try {
    const res = await fetch(`${base()}/clone`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: text.slice(0, 600), sample: sampleUrl, language }),
      signal: AbortSignal.timeout(60000),
    });
    if (!res.ok) return null;
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}
