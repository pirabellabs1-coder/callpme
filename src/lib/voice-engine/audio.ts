/**
 * Utilitaires audio du moteur vocal.
 *
 * Le téléphone transporte de l'audio G.711 µ-law à 8 kHz, mono. C'est aussi
 * le format commun du moteur (entrée STT, sortie TTS, test navigateur) : une
 * seule représentation de bout en bout, pas de transcodage sur le chemin chaud.
 */

const BIAS = 0x84;
const CLIP = 32635;

/** Échantillon PCM 16 bits -> octet µ-law. */
export function linearToMulaw(sample: number): number {
  let s = Math.max(-CLIP, Math.min(CLIP, sample | 0));
  const sign = s < 0 ? 0x80 : 0;
  if (sign) s = -s;
  s += BIAS;
  let exponent = 7;
  for (let mask = 0x4000; (s & mask) === 0 && exponent > 0; mask >>= 1) exponent--;
  const mantissa = (s >> (exponent + 3)) & 0x0f;
  return ~(sign | (exponent << 4) | mantissa) & 0xff;
}

/** Octet µ-law -> échantillon PCM 16 bits. */
export function mulawToLinear(byte: number): number {
  const u = ~byte & 0xff;
  const sign = u & 0x80;
  const exponent = (u >> 4) & 0x07;
  const mantissa = u & 0x0f;
  const magnitude = (((mantissa << 3) + BIAS) << exponent) - BIAS;
  return sign ? -magnitude : magnitude;
}

/** Buffer µ-law -> Int16Array PCM. */
export function decodeMulaw(buf: Uint8Array): Int16Array {
  const out = new Int16Array(buf.length);
  for (let i = 0; i < buf.length; i++) out[i] = mulawToLinear(buf[i]);
  return out;
}

/** Int16Array PCM -> Buffer µ-law. */
export function encodeMulaw(pcm: Int16Array): Buffer {
  const out = Buffer.alloc(pcm.length);
  for (let i = 0; i < pcm.length; i++) out[i] = linearToMulaw(pcm[i]);
  return out;
}

/** Énergie RMS normalisée (0..1) d'un bloc µ-law — détection simple de parole. */
export function mulawRms(buf: Uint8Array): number {
  if (buf.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < buf.length; i++) {
    const v = mulawToLinear(buf[i]) / 32768;
    sum += v * v;
  }
  return Math.sqrt(sum / buf.length);
}

/** Découpe un buffer en trames de `size` octets (20 ms à 8 kHz = 160 octets). */
export function frames(buf: Buffer, size = 160): Buffer[] {
  const out: Buffer[] = [];
  for (let i = 0; i < buf.length; i += size) out.push(buf.subarray(i, Math.min(i + size, buf.length)));
  return out;
}
