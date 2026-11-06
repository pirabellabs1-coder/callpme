/**
 * Chiffrement au repos des identifiants tiers (opérateurs, intégrations).
 *
 * AES-256-GCM, IV aléatoire de 12 octets, tag d'authentification.
 * Format stocké : "enc:v1:<iv b64>:<tag b64>:<données b64>".
 *
 * Clé : ENCRYPTION_KEY (recommandé, ≥ 32 caractères), sinon dérivée du secret
 * d'authentification (NEXTAUTH_SECRET). Changer la clé rend les anciens
 * identifiants illisibles : les ressaisir dans ce cas.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { getAuthSecret } from "../auth/secret";

const PREFIX = "enc:v1:";

function key(): Buffer {
  const raw = process.env.ENCRYPTION_KEY && process.env.ENCRYPTION_KEY.length >= 32
    ? process.env.ENCRYPTION_KEY
    : `callpme-secrets:${getAuthSecret()}`;
  return createHash("sha256").update(raw).digest();
}

export function isEncrypted(value: string | null | undefined): boolean {
  return typeof value === "string" && value.startsWith(PREFIX);
}

/** Chiffre une valeur (null/vide conservé tel quel ; déjà chiffré = inchangé). */
export function encryptSecret(value: string | null | undefined): string | null {
  if (!value) return null;
  if (isEncrypted(value)) return value;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64")}:${tag.toString("base64")}:${data.toString("base64")}`;
}

/** Déchiffre une valeur ; une valeur héritée non chiffrée est renvoyée telle quelle. */
export function decryptSecret(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!isEncrypted(value)) return value;
  const [ivB64, tagB64, dataB64] = value.slice(PREFIX.length).split(":");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString("utf8");
}
