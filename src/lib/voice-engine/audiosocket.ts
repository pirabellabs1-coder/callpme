/**
 * Protocole AudioSocket d'Asterisk (passerelle SIP de Callpme).
 *
 * Asterisk ouvre une connexion TCP vers le serveur vocal et échange des
 * messages : 1 octet de type, 2 octets de longueur (gros-boutiste), données.
 *  - 0x00 raccroché · 0x01 identifiant (UUID, 16 octets) · 0x03 touche DTMF
 *  - 0x10 audio : PCM signé 16 bits petit-boutiste, 8 kHz, mono
 *  - 0xff erreur
 * Le moteur vocal travaille en µ-law 8 kHz : conversion dans les deux sens.
 */
import { decodeMulaw, encodeMulaw } from "./audio";

export const AS_HANGUP = 0x00;
export const AS_UUID = 0x01;
export const AS_DTMF = 0x03;
export const AS_AUDIO = 0x10;
export const AS_ERROR = 0xff;

/** 20 ms d'audio en PCM 16 bits 8 kHz. */
export const SLIN_FRAME_BYTES = 320;

export interface AudioSocketMessage {
  type: number;
  payload: Buffer;
}

/** Découpe un flux TCP en messages complets (les données peuvent arriver par morceaux). */
export class AudioSocketParser {
  private buf: Buffer = Buffer.alloc(0);
  /** Taille maximale d'un message accepté (protection mémoire). */
  constructor(private readonly maxPayload = 8 * 1024) {}

  push(chunk: Buffer): AudioSocketMessage[] {
    this.buf = this.buf.length ? Buffer.concat([this.buf, chunk]) : chunk;
    const out: AudioSocketMessage[] = [];
    while (this.buf.length >= 3) {
      const type = this.buf[0];
      const len = this.buf.readUInt16BE(1);
      if (len > this.maxPayload) throw new Error("Message AudioSocket trop long.");
      if (this.buf.length < 3 + len) break;
      out.push({ type, payload: this.buf.subarray(3, 3 + len) });
      this.buf = this.buf.subarray(3 + len);
    }
    if (this.buf.length > this.maxPayload + 3) throw new Error("Tampon AudioSocket saturé.");
    return out;
  }
}

export function encodeMessage(type: number, payload: Buffer = Buffer.alloc(0)): Buffer {
  const head = Buffer.alloc(3);
  head[0] = type;
  head.writeUInt16BE(payload.length, 1);
  return Buffer.concat([head, payload]);
}

/** UUID (16 octets) -> forme texte « xxxxxxxx-xxxx-… ». */
export function uuidFromBytes(b: Buffer): string | null {
  if (b.length !== 16) return null;
  const h = b.toString("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** PCM 16 bits petit-boutiste -> µ-law. */
export function slinToMulaw(slin: Buffer): Buffer {
  const samples = new Int16Array(Math.floor(slin.length / 2));
  for (let i = 0; i < samples.length; i++) samples[i] = slin.readInt16LE(i * 2);
  return encodeMulaw(samples);
}

/** µ-law -> PCM 16 bits petit-boutiste. */
export function mulawToSlin(mulaw: Buffer): Buffer {
  const pcm = decodeMulaw(mulaw);
  const out = Buffer.alloc(pcm.length * 2);
  for (let i = 0; i < pcm.length; i++) out.writeInt16LE(pcm[i], i * 2);
  return out;
}

/**
 * Cadence d'envoi : Asterisk joue l'audio au fil de l'eau, il faut lui
 * transmettre 20 ms toutes les 20 ms (sinon saccades ou perte).
 */
export class SlinPacer {
  private queue: Buffer[] = [];
  private pending: Buffer = Buffer.alloc(0);
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly send: (frame: Buffer) => void) {}

  push(slin: Buffer) {
    let data = this.pending.length ? Buffer.concat([this.pending, slin]) : slin;
    while (data.length >= SLIN_FRAME_BYTES) {
      this.queue.push(data.subarray(0, SLIN_FRAME_BYTES));
      data = data.subarray(SLIN_FRAME_BYTES);
    }
    this.pending = data;
    if (!this.timer && this.queue.length) this.timer = setInterval(() => this.tick(), 20);
  }

  private tick() {
    const frame = this.queue.shift();
    if (frame) this.send(frame);
    else this.stop();
  }

  /** Coupe l'audio en attente (l'appelant a interrompu l'agent). */
  clear() {
    this.queue = [];
    this.pending = Buffer.alloc(0);
    this.stop();
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  get queuedMs(): number {
    return this.queue.length * 20;
  }
}
