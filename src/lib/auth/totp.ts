/**
 * Double authentification : codes à usage unique basés sur le temps (TOTP,
 * RFC 6238), compatibles Google Authenticator, Microsoft Authenticator,
 * 1Password, Authy… Codes à 6 chiffres, renouvelés toutes les 30 secondes.
 *
 * Les codes de secours (si le téléphone est perdu) ne sont stockés que sous
 * forme d'empreintes et ne servent qu'une fois.
 */
import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { getAuthSecret } from "./secret";

const STEP_SECONDS = 30;
const DIGITS = 6;
/** Tolérance d'horloge : le code précédent et le suivant sont acceptés. */
const WINDOW = 1;
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (let i = 0; i < buf.length; i++) {
    const byte = buf[i];
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/[\s=-]/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = B32.indexOf(ch);
    if (idx < 0) throw new Error("Clé invalide");
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** Nouveau secret (160 bits, recommandé par la RFC 4226). */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

/** Code d'un pas de temps donné. */
export function totpAt(secret: string, step: number): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const mac = createHmac("sha1", base32Decode(secret)).update(counter).digest();
  const offset = mac[mac.length - 1] & 0x0f;
  const bin = (mac.readUInt32BE(offset) & 0x7fffffff) % 10 ** DIGITS;
  return bin.toString().padStart(DIGITS, "0");
}

export function currentStep(now = Date.now()): number {
  return Math.floor(now / 1000 / STEP_SECONDS);
}

/**
 * Vérifie un code. Renvoie le pas de temps reconnu (à mémoriser pour refuser
 * la réutilisation du même code), ou null. `lastStep` : dernier pas accepté.
 */
export function verifyTotp(secret: string, code: string, lastStep: number | null | undefined, now = Date.now()): number | null {
  const given = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(given)) return null;
  const cur = currentStep(now);
  for (let d = -WINDOW; d <= WINDOW; d++) {
    const step = cur + d;
    if (lastStep != null && step <= lastStep) continue;
    const expected = totpAt(secret, step);
    if (timingSafeEqual(Buffer.from(expected), Buffer.from(given))) return step;
  }
  return null;
}

/** Adresse à encoder dans le QR code (applications d'authentification). */
export function otpauthUri(secret: string, account: string, issuer = "Callpme"): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${DIGITS}&period=${STEP_SECONDS}`;
}

/* ---------------------------- Codes de secours ---------------------------- */

const BACKUP_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sans 0/O ni 1/I

export function normalizeBackupCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function hashBackupCode(code: string): string {
  // HMAC avec le secret serveur : une fuite de la base seule ne permet pas de retrouver les codes.
  return createHmac("sha256", getAuthSecret()).update(`callpme-2fa-backup:${normalizeBackupCode(code)}`).digest("hex");
}

/** 10 codes « XXXX-XXXX » ; seules leurs empreintes sont enregistrées. */
export function generateBackupCodes(count = 10): { codes: string[]; hashes: string[] } {
  const codes = Array.from({ length: count }, () => {
    const bytes = randomBytes(8);
    const chars = Array.from(bytes, (b) => BACKUP_ALPHABET[b % BACKUP_ALPHABET.length]).join("");
    return `${chars.slice(0, 4)}-${chars.slice(4)}`;
  });
  return { codes, hashes: codes.map(hashBackupCode) };
}

/** Consomme un code de secours : renvoie la liste restante, ou null si le code est inconnu. */
export function consumeBackupCode(storedJson: string | null | undefined, code: string): string[] | null {
  let hashes: string[] = [];
  try {
    hashes = storedJson ? (JSON.parse(storedJson) as string[]) : [];
  } catch {
    return null;
  }
  const h = hashBackupCode(code);
  const idx = hashes.findIndex((x) => x.length === h.length && timingSafeEqual(Buffer.from(x), Buffer.from(h)));
  if (idx < 0) return null;
  return hashes.filter((_, i) => i !== idx);
}
