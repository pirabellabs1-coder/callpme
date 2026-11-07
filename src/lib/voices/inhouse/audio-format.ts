/**
 * Formats audio des voix maison — module pur (navigateur ET serveur).
 *
 * - reconnaissance du format réel d'un fichier par ses premiers octets
 *   (on ne fait pas confiance au type MIME envoyé par le navigateur) ;
 * - durée d'un WAV lue dans son en-tête ;
 * - encodage WAV PCM 16 bits (enregistrement navigateur, écoute des aperçus).
 */

export type DatasetAudioMime = "audio/wav" | "audio/flac" | "audio/mpeg" | "audio/ogg" | "audio/webm";

function ascii(b: Uint8Array, at: number, text: string): boolean {
  if (b.length < at + text.length) return false;
  for (let i = 0; i < text.length; i++) if (b[at + i] !== text.charCodeAt(i)) return false;
  return true;
}

/** Format audio réel d'après la signature binaire, ou null si non reconnu. */
export function sniffAudio(b: Uint8Array): DatasetAudioMime | null {
  if (ascii(b, 0, "RIFF") && ascii(b, 8, "WAVE")) return "audio/wav";
  if (ascii(b, 0, "fLaC")) return "audio/flac";
  if (ascii(b, 0, "OggS")) return "audio/ogg";
  if (b.length >= 4 && b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return "audio/webm";
  if (ascii(b, 0, "ID3")) return "audio/mpeg";
  if (b.length >= 2 && b[0] === 0xff && (b[1] & 0xe0) === 0xe0) return "audio/mpeg";
  return null;
}

export interface WavInfo {
  channels: number;
  sampleRate: number;
  bitsPerSample: number;
  durationMs: number;
}

/** Lit l'en-tête d'un WAV (chunks fmt + data). Null si le fichier n'est pas un WAV lisible. */
export function wavInfo(b: Uint8Array): WavInfo | null {
  if (sniffAudio(b) !== "audio/wav") return null;
  const view = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let fmt: Omit<WavInfo, "durationMs"> & { byteRate: number } | null = null;
  let offset = 12;
  while (offset + 8 <= b.length) {
    const size = view.getUint32(offset + 4, true);
    const body = offset + 8;
    if (ascii(b, offset, "fmt ") && body + 16 <= b.length) {
      fmt = {
        channels: view.getUint16(body + 2, true),
        sampleRate: view.getUint32(body + 4, true),
        byteRate: view.getUint32(body + 8, true),
        bitsPerSample: view.getUint16(body + 14, true),
      };
    } else if (ascii(b, offset, "data")) {
      if (!fmt || fmt.byteRate === 0) return null;
      // Un WAV en flux peut annoncer une taille de données fausse : on borne au fichier réel.
      const dataBytes = Math.min(size, b.length - body);
      const { byteRate, ...rest } = fmt;
      return { ...rest, durationMs: Math.round((dataBytes / byteRate) * 1000) };
    }
    offset = body + size + (size % 2);
  }
  return null;
}

/** Encode des échantillons PCM 16 bits mono en fichier WAV. */
export function pcm16ToWav(pcm: Int16Array, sampleRate: number) {
  const dataBytes = pcm.length * 2;
  const out = new Uint8Array(44 + dataBytes);
  const v = new DataView(out.buffer);
  const write = (at: number, text: string) => {
    for (let i = 0; i < text.length; i++) out[at + i] = text.charCodeAt(i);
  };
  write(0, "RIFF");
  v.setUint32(4, 36 + dataBytes, true);
  write(8, "WAVE");
  write(12, "fmt ");
  v.setUint32(16, 16, true); // taille du chunk fmt
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  write(36, "data");
  v.setUint32(40, dataBytes, true);
  for (let i = 0; i < pcm.length; i++) v.setInt16(44 + i * 2, pcm[i], true);
  return out;
}

/** Float32 [-1, 1] (Web Audio) -> PCM 16 bits. */
export function floatToPcm16(samples: Float32Array): Int16Array {
  const out = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    out[i] = s < 0 ? Math.round(s * 0x8000) : Math.round(s * 0x7fff);
  }
  return out;
}
