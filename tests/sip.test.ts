import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AS_AUDIO,
  AS_HANGUP,
  AS_UUID,
  AudioSocketParser,
  encodeMessage,
  mulawToSlin,
  SLIN_FRAME_BYTES,
  SlinPacer,
  slinToMulaw,
  uuidFromBytes,
} from "@/lib/voice-engine/audiosocket";
import { checkGatewayKey, sipConfigured } from "@/lib/telephony/sip";

const env = { ...process.env };
afterEach(() => {
  process.env = { ...env };
  vi.useRealTimers();
});

describe("protocole AudioSocket", () => {
  it("reconstitue des messages arrivés par morceaux", () => {
    const uuid = Buffer.from("0123456789abcdef0123456789abcdef", "hex");
    const stream = Buffer.concat([encodeMessage(AS_UUID, uuid), encodeMessage(AS_AUDIO, Buffer.alloc(320, 1)), encodeMessage(AS_HANGUP)]);
    const parser = new AudioSocketParser();
    const got = [...parser.push(stream.subarray(0, 10)), ...parser.push(stream.subarray(10, 200)), ...parser.push(stream.subarray(200))];
    expect(got.map((m) => m.type)).toEqual([AS_UUID, AS_AUDIO, AS_HANGUP]);
    expect(uuidFromBytes(got[0].payload)).toBe("01234567-89ab-cdef-0123-456789abcdef");
    expect(got[1].payload.length).toBe(320);
    expect(got[2].payload.length).toBe(0);
  });

  it("refuse un message plus long que la limite", () => {
    const parser = new AudioSocketParser(1000);
    const head = Buffer.from([AS_AUDIO, 0xff, 0xff]);
    expect(() => parser.push(head)).toThrow();
  });

  it("rejette un identifiant de taille incorrecte", () => {
    expect(uuidFromBytes(Buffer.alloc(15))).toBeNull();
  });

  it("convertit PCM 16 bits <-> µ-law sans dérive notable", () => {
    const slin = Buffer.alloc(320);
    for (let i = 0; i < 160; i++) slin.writeInt16LE(Math.round(8000 * Math.sin(i / 8)), i * 2);
    const mulaw = slinToMulaw(slin);
    expect(mulaw.length).toBe(160);
    const back = mulawToSlin(mulaw);
    expect(back.length).toBe(320);
    for (let i = 0; i < 160; i++) {
      expect(Math.abs(back.readInt16LE(i * 2) - slin.readInt16LE(i * 2))).toBeLessThan(400);
    }
  });
});

describe("cadence d'envoi audio", () => {
  it("envoie 20 ms toutes les 20 ms et garde le reste", () => {
    vi.useFakeTimers();
    const sent: Buffer[] = [];
    const pacer = new SlinPacer((f) => sent.push(f));
    pacer.push(Buffer.alloc(SLIN_FRAME_BYTES * 2 + 100));
    expect(pacer.queuedMs).toBe(40);
    vi.advanceTimersByTime(20);
    expect(sent.length).toBe(1);
    pacer.push(Buffer.alloc(SLIN_FRAME_BYTES - 100)); // complète la trame partielle
    vi.advanceTimersByTime(100);
    expect(sent.length).toBe(3);
    expect(sent.every((f) => f.length === SLIN_FRAME_BYTES)).toBe(true);
  });

  it("vide la file quand l'appelant interrompt", () => {
    vi.useFakeTimers();
    const sent: Buffer[] = [];
    const pacer = new SlinPacer((f) => sent.push(f));
    pacer.push(Buffer.alloc(SLIN_FRAME_BYTES * 10));
    vi.advanceTimersByTime(20);
    pacer.clear();
    vi.advanceTimersByTime(200);
    expect(sent.length).toBe(1);
    expect(pacer.queuedMs).toBe(0);
  });
});

describe("secret de la passerelle SIP", () => {
  const secret = "s".repeat(32);

  it("accepte seulement le bon secret", () => {
    process.env.SIP_GATEWAY_SECRET = secret;
    expect(checkGatewayKey(secret)).toBe(true);
    expect(checkGatewayKey("s".repeat(31))).toBe(false);
    expect(checkGatewayKey("x".repeat(32))).toBe(false);
    expect(checkGatewayKey(null)).toBe(false);
  });

  it("refuse tout si le secret configuré est trop court", () => {
    process.env.SIP_GATEWAY_SECRET = "court";
    expect(checkGatewayKey("court")).toBe(false);
  });

  it("n'active la passerelle que si tout est configuré", () => {
    process.env.TELEPHONY_PROVIDER = "sip";
    process.env.ASTERISK_ARI_URL = "http://asterisk:8088";
    process.env.ASTERISK_ARI_USER = "callpme";
    process.env.ASTERISK_ARI_PASSWORD = "p";
    process.env.SIP_GATEWAY_SECRET = secret;
    expect(sipConfigured()).toBe(true);
    delete process.env.ASTERISK_ARI_PASSWORD;
    expect(sipConfigured()).toBe(false);
  });
});

describe("accès des routes de la passerelle", () => {
  const secret = "k".repeat(32);
  const q = new URLSearchParams();

  it("lit le secret dans l'en-tête et filtre par IP si une liste est définie", async () => {
    const { gatewayAuthorized } = await import("@/lib/telephony/sip");
    process.env.SIP_GATEWAY_SECRET = secret;
    expect(gatewayAuthorized(new Headers({ "x-callpme-key": secret }), q)).toBe(true);
    expect(gatewayAuthorized(new Headers({ "x-callpme-key": "faux" }), q)).toBe(false);
    process.env.SIP_GATEWAY_ALLOW = "10.0.0.5";
    expect(gatewayAuthorized(new Headers({ "x-callpme-key": secret, "x-forwarded-for": "203.0.113.9" }), q)).toBe(false);
    expect(gatewayAuthorized(new Headers({ "x-callpme-key": secret, "x-forwarded-for": "10.0.0.5, 1.1.1.1" }), q)).toBe(true);
  });
});
