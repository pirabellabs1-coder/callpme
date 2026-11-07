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

/** Télécharge une note vocale (2 étapes : URL signée, puis contenu). */
export async function downloadWhatsAppMedia(mediaId: string, token: string): Promise<{ data: Buffer; mime: string } | null> {
  const meta = await fetch(`${GRAPH}/${encodeURIComponent(mediaId)}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);
  if (!meta?.ok) return null;
  const info = (await meta.json().catch(() => ({}))) as { url?: string; mime_type?: string; file_size?: number };
  if (!info.url || !isMetaMediaUrl(info.url) || !info.file_size || info.file_size > MAX_VOICE_BYTES) return null;
  const res = await fetch(info.url, { headers: { Authorization: `Bearer ${token}` }, redirect: "error", signal: AbortSignal.timeout(20_000) }).catch(
    () => null,
  );
  if (!res?.ok) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_VOICE_BYTES) return null;
  return { data: buf, mime: info.mime_type ?? "audio/ogg" };
}

/** Transcription d'une note vocale (Deepgram, fichier complet). */
export async function transcribeAudio(audio: Buffer, mime: string, language = "fr"): Promise<string | null> {
  const key = process.env.DEEPGRAM_API_KEY;
  if (!key) return null;
  const model = process.env.DEEPGRAM_MODEL || "nova-2";
  const res = await fetch(
    `https://api.deepgram.com/v1/listen?model=${encodeURIComponent(model)}&language=${encodeURIComponent(language)}&smart_format=true&punctuate=true`,
    {
      method: "POST",
      headers: { Authorization: `Token ${key}`, "Content-Type": mime.split(";")[0] || "audio/ogg" },
      body: new Uint8Array(audio),
      signal: AbortSignal.timeout(30_000),
    },
  ).catch(() => null);
  if (!res?.ok) return null;
  const data = (await res.json().catch(() => ({}))) as {
    results?: { channels?: { alternatives?: { transcript?: string }[] }[] };
  };
  const text = data.results?.channels?.[0]?.alternatives?.[0]?.transcript?.trim();
  return text || null;
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
