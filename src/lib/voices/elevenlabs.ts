/**
 * Accès à la bibliothèque de voix ElevenLabs (côté serveur uniquement : la clé
 * ne quitte jamais le serveur). Sert au catalogue de voix de la plateforme.
 */

const API = "https://api.elevenlabs.io";

export interface LibraryVoice {
  /** Identifiant de la voix (dans la bibliothèque publique ou le compte). */
  voiceId: string;
  /** Propriétaire public : requis pour ajouter une voix de la bibliothèque au compte. */
  ownerId: string | null;
  name: string;
  description: string | null;
  gender: string | null;
  age: string | null;
  accent: string | null;
  language: string | null;
  useCase: string | null;
  previewUrl: string | null;
  /** « library » : bibliothèque publique ; « account » : déjà dans le compte. */
  source: "library" | "account";
}

export interface LibraryFilters {
  search?: string;
  gender?: string;
  age?: string;
  accent?: string;
  useCase?: string;
  language?: string;
  page?: number;
}

export function hasElevenLabs(): boolean {
  return Boolean(process.env.ELEVENLABS_API_KEY);
}

async function call(path: string, init: RequestInit = {}): Promise<Response> {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error("ElevenLabs n'est pas configuré (ELEVENLABS_API_KEY).");
  return fetch(`${API}${path}`, {
    ...init,
    headers: { "xi-api-key": key, "Content-Type": "application/json", ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
}

/** Message d'erreur ElevenLabs lisible, sans détail technique sensible. */
async function failure(res: Response, what: string): Promise<Error> {
  let detail = "";
  try {
    const body = (await res.json()) as { detail?: { message?: string } | string };
    detail = typeof body.detail === "string" ? body.detail : (body.detail?.message ?? "");
  } catch {
    /* corps illisible */
  }
  return new Error(`${what} (ElevenLabs ${res.status}${detail ? ` : ${detail.slice(0, 160)}` : ""}).`);
}

const GENDERS: Record<string, string> = { female: "feminine", male: "masculine", neutral: "neutral" };

/** Genre ElevenLabs → genre Callpme. */
export function mapGender(g: unknown): string | null {
  return typeof g === "string" ? (GENDERS[g.toLowerCase()] ?? null) : null;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/** Recherche dans la bibliothèque publique (voix françaises par défaut). */
export async function searchLibrary(f: LibraryFilters): Promise<{ voices: LibraryVoice[]; hasMore: boolean }> {
  const q = new URLSearchParams({ page_size: "30", language: f.language || "fr" });
  if (f.search) q.set("search", f.search.slice(0, 80));
  if (f.gender) q.set("gender", f.gender);
  if (f.age) q.set("age", f.age);
  if (f.accent) q.set("accent", f.accent.slice(0, 40));
  if (f.useCase) q.set("use_cases", f.useCase);
  if (f.page && f.page > 0) q.set("page", String(Math.min(f.page, 50)));
  const res = await call(`/v1/shared-voices?${q.toString()}`);
  if (!res.ok) throw await failure(res, "Recherche impossible");
  const body = (await res.json()) as { voices?: Record<string, unknown>[]; has_more?: boolean };
  const voices = (body.voices ?? []).map(
    (v): LibraryVoice => ({
      voiceId: String(v.voice_id),
      ownerId: str(v.public_owner_id),
      name: str(v.name) ?? "Voix",
      description: str(v.description),
      gender: mapGender(v.gender),
      age: str(v.age),
      accent: str(v.accent),
      language: str(v.language),
      useCase: str(v.use_case),
      previewUrl: str(v.preview_url),
      source: "library",
    }),
  );
  return { voices, hasMore: Boolean(body.has_more) };
}

/** Voix déjà présentes dans le compte ElevenLabs de la plateforme. */
export async function listAccountVoices(): Promise<LibraryVoice[]> {
  const res = await call(`/v2/voices?page_size=100`);
  if (!res.ok) throw await failure(res, "Lecture des voix du compte impossible");
  const body = (await res.json()) as { voices?: Record<string, unknown>[] };
  return (body.voices ?? []).map((v): LibraryVoice => {
    const labels = (v.labels ?? {}) as Record<string, unknown>;
    return {
      voiceId: String(v.voice_id),
      ownerId: null,
      name: str(v.name) ?? "Voix",
      description: str(v.description) ?? str(labels.description),
      gender: mapGender(labels.gender),
      age: str(labels.age),
      accent: str(labels.accent),
      language: str(labels.language),
      useCase: str(labels.use_case) ?? str(labels["use case"]),
      previewUrl: str(v.preview_url),
      source: "account",
    };
  });
}

/**
 * Ajoute une voix de la bibliothèque publique au compte (obligatoire pour s'en
 * servir en synthèse). Renvoie l'identifiant utilisable dans le compte.
 */
export async function addLibraryVoice(ownerId: string, voiceId: string, name: string): Promise<string> {
  if (!/^[A-Za-z0-9_-]{6,80}$/.test(ownerId) || !/^[A-Za-z0-9_-]{6,64}$/.test(voiceId)) {
    throw new Error("Identifiants de voix invalides.");
  }
  const res = await call(`/v1/voices/add/${ownerId}/${voiceId}`, {
    method: "POST",
    body: JSON.stringify({ new_name: name.slice(0, 80) }),
  });
  if (!res.ok) throw await failure(res, "Ajout de la voix impossible");
  const body = (await res.json()) as { voice_id?: string };
  if (!body.voice_id) throw new Error("ElevenLabs n'a pas renvoyé d'identifiant de voix.");
  return body.voice_id;
}
