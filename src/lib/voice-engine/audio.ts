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

/**
 * Rééchantillonne un PCM 16 bits vers 8 kHz (interpolation linéaire, avec un
 * filtre moyenneur simple pour limiter le repliement). Sert aux fournisseurs
 * de voix qui ne livrent pas directement le format téléphonique.
 */
export function resampleTo8k(pcm: Int16Array, fromRate: number): Int16Array {
  if (fromRate === 8000) return pcm;
  const ratio = fromRate / 8000;
  const outLen = Math.floor(pcm.length / ratio);
  const out = new Int16Array(outLen);
  const half = Math.max(0, Math.floor(ratio / 2));
  for (let i = 0; i < outLen; i++) {
    const center = i * ratio;
    const i0 = Math.floor(center);
    let sum = 0;
    let n = 0;
    for (let k = i0 - half; k <= i0 + half; k++) {
      if (k >= 0 && k < pcm.length) {
        sum += pcm[k];
        n++;
      }
    }
    out[i] = n ? Math.round(sum / n) : 0;
  }
  return out;
}

/** PCM 16 bits little-endian (Buffer) -> Int16Array. Un octet impair final est ignoré. */
export function pcm16FromBytes(buf: Uint8Array): Int16Array {
  const n = Math.floor(buf.length / 2);
  const out = new Int16Array(n);
  for (let i = 0; i < n; i++) {
    const v = buf[2 * i] | (buf[2 * i + 1] << 8);
    out[i] = v >= 0x8000 ? v - 0x10000 : v;
  }
  return out;
}

/** Enveloppe un PCM 16 bits mono dans un fichier WAV (pour les API de transcription par fichier). */
export function wavFromPcm16(pcm: Int16Array, sampleRate = 8000): Buffer {
  const data = Buffer.alloc(pcm.length * 2);
  for (let i = 0; i < pcm.length; i++) data.writeInt16LE(pcm[i], i * 2);
  const h = Buffer.alloc(44);
  h.write("RIFF", 0);
  h.writeUInt32LE(36 + data.length, 4);
  h.write("WAVE", 8);
  h.write("fmt ", 12);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20); // PCM
  h.writeUInt16LE(1, 22); // mono
  h.writeUInt32LE(sampleRate, 24);
  h.writeUInt32LE(sampleRate * 2, 28);
  h.writeUInt16LE(2, 32);
  h.writeUInt16LE(16, 34);
  h.write("data", 36);
  h.writeUInt32LE(data.length, 40);
  return Buffer.concat([h, data]);
}

/**
 * Extrait le PCM d'un WAV 16 bits mono (en-tête RIFF lu, blocs inconnus sautés).
 * Renvoie null si ce n'est pas un WAV PCM 16 bits mono.
 */
export function parseWav(buf: Buffer): { pcm: Int16Array; sampleRate: number } | null {
  if (buf.length < 12 || buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WAVE") return null;
  let off = 12;
  let rate = 0;
  let ok = false;
  while (off + 8 <= buf.length) {
    const id = buf.toString("ascii", off, off + 4);
    const size = buf.readUInt32LE(off + 4);
    const body = off + 8;
    if (id === "fmt ") {
      const format = buf.readUInt16LE(body);
      const channels = buf.readUInt16LE(body + 2);
      rate = buf.readUInt32LE(body + 4);
      const bits = buf.readUInt16LE(body + 14);
      ok = format === 1 && channels === 1 && bits === 16;
    } else if (id === "data") {
      if (!ok) return null;
      const end = Math.min(buf.length, body + size);
      return { pcm: pcm16FromBytes(buf.subarray(body, end)), sampleRate: rate };
    }
    off = body + size + (size % 2);
  }
  return null;
}
