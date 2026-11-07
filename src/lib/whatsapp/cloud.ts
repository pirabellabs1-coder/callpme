/**
 * API WhatsApp Business Cloud (Meta) : signature des webhooks, envoi de
 * messages, téléchargement des notes vocales et transcription.
 */
import { createHmac, timingSafeEqual } from "crypto";

export const GRAPH = "https://graph.facebook.com/v21.0";
/** Notes vocales acceptées : 1 Mo (environ 8 minutes en Opus). Au-delà, refus sans téléchargement. */
export const MAX_VOICE_BYTES = 1024 * 1024;

/** Vérifie l'en-tête X-Hub-Signature-256 (HMAC-SHA256 du corps brut avec le secret de l'application). */
export function verifyMetaSignature(appSecret: string, rawBody: string, header: string | null): boolean {
  if (!header?.startsWith("sha256=") || !appSecret) return false;
  const expected = "sha256=" + createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** WhatsApp limite un message texte à 4 096 caractères. */
export function clampWhatsAppText(text: string): string {
  return text.length > 4000 ? `${text.slice(0, 3990)}…` : text;
}

export async function sendWhatsAppText(phoneNumberId: string, token: string, to: string, body: string): Promise<boolean> {
  const res = await fetch(`${GRAPH}/${encodeURIComponent(phoneNumberId)}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: to.replace(/^\+/, ""),
      type: "text",
      text: { preview_url: false, body: clampWhatsAppText(body) },
    }),
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);
  return Boolean(res?.ok);
}

/**
 * Message à l'initiative de l'entreprise (hors fenêtre de 24 h) : Meta
 * n'accepte qu'un modèle approuvé. Les paramètres remplissent {{1}}, {{2}}…
 * du corps du modèle.
 */
export async function sendWhatsAppTemplate(
  phoneNumberId: string,
  token: string,
  to: string,
  template: { name: string; language: string; params: string[] },
): Promise<boolean> {
  const res = await fetch(`${GRAPH}/${encodeURIComponent(phoneNumberId)}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: to.replace(/^\+/, ""),
      type: "template",
      template: {
        name: template.name,
        language: { code: template.language },
        components: template.params.length
          ? [{ type: "body", parameters: template.params.map((text) => ({ type: "text", text })) }]
          : [],
      },
    }),
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);
  return Boolean(res?.ok);
}

/** Marque le message reçu comme lu (double coche bleue) : l'utilisateur voit qu'on l'a pris en compte. */
export async function markWhatsAppRead(phoneNumberId: string, token: string, messageId: string): Promise<void> {
  await fetch(`${GRAPH}/${encodeURIComponent(phoneNumberId)}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", status: "read", message_id: messageId }),
    signal: AbortSignal.timeout(5_000),
  }).catch(() => null);
}

/** Les médias WhatsApp ne sont servis que par les domaines de Meta. */
export function isMetaMediaUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && /(^|\.)(fbsbx\.com|facebook\.com|whatsapp\.net|fbcdn\.net)$/.test(u.hostname);
  } catch {
    return false;
  }
}

export type MediaDownload =
  | { ok: true; data: Buffer; mime: string }
  /** expired : média introuvable chez Meta (plus de 30 jours, ou supprimé) ; too_large ; unsupported : pas de l'audio. */
  | { ok: false; reason: "expired" | "too_large" | "unsupported" | "failed" };

/** Télécharge une note vocale (2 étapes : URL signée, puis contenu). */
export async function downloadWhatsAppMedia(mediaId: string, token: string): Promise<MediaDownload> {
  try {
    return await download(mediaId, token);
  } catch {
    // Coupure pendant la lecture du corps (délai dépassé) : jamais d'exception vers l'appelant.
    return { ok: false, reason: "failed" };
  }
}

async function download(mediaId: string, token: string): Promise<MediaDownload> {
  const meta = await fetch(`${GRAPH}/${encodeURIComponent(mediaId)}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);
  if (!meta) return { ok: false, reason: "failed" };
  if (!meta.ok) {
    // Média expiré ou inconnu : 404, ou 400 avec le code 100 (« objet inexistant »). Les autres 400 viennent de nous.
    const err = (await meta.json().catch(() => ({}))) as { error?: { code?: number } };
    const gone = meta.status === 404 || (meta.status === 400 && err.error?.code === 100);
    return { ok: false, reason: gone ? "expired" : "failed" };
  }
  const info = (await meta.json().catch(() => ({}))) as { url?: string; mime_type?: string; file_size?: number };
  if (!info.url || !isMetaMediaUrl(info.url)) return { ok: false, reason: "failed" };
  if (!info.file_size) return { ok: false, reason: "failed" };
  if (info.file_size > MAX_VOICE_BYTES) return { ok: false, reason: "too_large" };
  const mime = (info.mime_type ?? "audio/ogg").split(";")[0].trim().toLowerCase();
  if (!mime.startsWith("audio/")) return { ok: false, reason: "unsupported" };
  const res = await fetch(info.url, { headers: { Authorization: `Bearer ${token}` }, redirect: "error", signal: AbortSignal.timeout(20_000) }).catch(
    () => null,
  );
  if (!res) return { ok: false, reason: "failed" };
  if (res.status === 404 || res.status === 410) return { ok: false, reason: "expired" };
  if (!res.ok) return { ok: false, reason: "failed" };
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_VOICE_BYTES) return { ok: false, reason: "too_large" };
  return { ok: true, data: buf, mime };
}

/** Transcription d'une note vocale (Deepgram, fichier complet) et durée mesurée par Deepgram. */
export async function transcribeAudio(
  audio: Buffer,
  mime: string,
  languageParams: Record<string, string> = { language: "fr" },
  timeoutMs = 30_000,
): Promise<{ text: string | null; durationSec: number } | null> {
  const key = process.env.DEEPGRAM_API_KEY;
  if (!key) return null;
  const q = new URLSearchParams({ model: process.env.DEEPGRAM_MODEL || "nova-2", smart_format: "true", punctuate: "true", ...languageParams });
  const res = await fetch(`https://api.deepgram.com/v1/listen?${q}`, {
    method: "POST",
    headers: { Authorization: `Token ${key}`, "Content-Type": mime.split(";")[0] || "audio/ogg" },
    body: new Uint8Array(audio),
    signal: AbortSignal.timeout(Math.max(1_000, timeoutMs)),
  }).catch(() => null);
  if (!res?.ok) return null;
  const data = (await res.json().catch(() => ({}))) as {
    metadata?: { duration?: number };
    results?: { channels?: { alternatives?: { transcript?: string }[] }[] };
  };
  const text = data.results?.channels?.[0]?.alternatives?.[0]?.transcript?.trim() || null;
  // Durée renvoyée même sans texte (silence) : la transcription est payée quand même.
  return { text, durationSec: typeof data.metadata?.duration === "number" ? data.metadata.duration : 0 };
}

/** Dépose un fichier audio chez Meta ; renvoie l'identifiant du média, ou null. */
export async function uploadWhatsAppMedia(phoneNumberId: string, token: string, data: Buffer, mime: string): Promise<string | null> {
  const form = new FormData();
  form.append("messaging_product", "whatsapp");
  form.append("type", mime);
  form.append("file", new Blob([new Uint8Array(data)], { type: mime }), "reponse.ogg");
  const res = await fetch(`${GRAPH}/${encodeURIComponent(phoneNumberId)}/media`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
    signal: AbortSignal.timeout(20_000),
  }).catch(() => null);
  if (!res?.ok) return null;
  const json = (await res.json().catch(() => ({}))) as { id?: string };
  return typeof json.id === "string" && json.id ? json.id : null;
}

/**
 * Envoie une note vocale déjà déposée (OGG/Opus : affichée comme message vocal).
 * « unknown » : pas de réponse de Meta (délai dépassé) — le message est peut-être parti.
 */
export async function sendWhatsAppVoice(phoneNumberId: string, token: string, to: string, mediaId: string): Promise<"sent" | "rejected" | "unknown"> {
  const res = await fetch(`${GRAPH}/${encodeURIComponent(phoneNumberId)}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: to.replace(/^\+/, ""),
      type: "audio",
      audio: { id: mediaId, voice: true },
    }),
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);
  if (!res) return "unknown";
  return res.ok ? "sent" : "rejected";
}

/** Vérifie les identifiants à l'enregistrement : renvoie le numéro affiché, ou null. */
export async function checkWhatsAppCredentials(phoneNumberId: string, token: string): Promise<string | null> {
  const res = await fetch(`${GRAPH}/${encodeURIComponent(phoneNumberId)}?fields=display_phone_number,verified_name`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);
  if (!res?.ok) return null;
  const data = (await res.json().catch(() => ({}))) as { display_phone_number?: string };
  return data.display_phone_number ?? "";
}
