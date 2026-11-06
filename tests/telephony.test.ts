import { afterEach, describe, expect, it } from "vitest";
import { createHmac, generateKeyPairSync, sign } from "crypto";
import {
  streamInstructions,
  toE164,
  verifyTelnyxSignature,
  verifyTwilioSignature,
} from "@/lib/telephony/provider";
import { createVoiceToken, verifyVoiceToken } from "@/lib/voice-engine/token";
import { decodeMulaw, encodeMulaw, linearToMulaw, mulawToLinear } from "@/lib/voice-engine/audio";

const env = { ...process.env };
afterEach(() => {
  process.env = { ...env };
});

describe("jeton du serveur vocal", () => {
  const base = { callId: "c1", agentId: "a1", organizationId: "o1", direction: "inbound" as const, from: "+33600000000", to: "+33100000000" };

  it("est vérifié et restitue le contexte de l'appel", () => {
    const t = createVoiceToken(base);
    expect(verifyVoiceToken(t)).toMatchObject(base);
  });

  it("refuse un jeton altéré, mal formé ou expiré", () => {
    const t = createVoiceToken(base);
    const [body, sig] = t.split(".");
    const forged = Buffer.from(JSON.stringify({ ...base, organizationId: "autre", exp: Date.now() + 60_000 })).toString("base64url");
    expect(verifyVoiceToken(`${forged}.${sig}`)).toBeNull();
    expect(verifyVoiceToken(`${body}.AAAA`)).toBeNull();
    expect(verifyVoiceToken("n'importe quoi")).toBeNull();
    expect(verifyVoiceToken(createVoiceToken(base, -1000))).toBeNull();
  });
});

describe("signature Twilio", () => {
  it("accepte la signature officielle et refuse une signature fausse", () => {
    process.env.TWILIO_AUTH_TOKEN = "tok";
    const url = "https://app.callpme.com/api/telephony/inbound";
    const params = { To: "+33100000000", From: "+33600000000", CallSid: "CA1" };
    const data = url + Object.keys(params).sort().map((k) => k + params[k as keyof typeof params]).join("");
    const good = createHmac("sha1", "tok").update(data).digest("base64");
    expect(verifyTwilioSignature(url, params, good)).toBe(true);
    expect(verifyTwilioSignature(url, { ...params, To: "+33999999999" }, good)).toBe(false);
    expect(verifyTwilioSignature(url, params, null)).toBe(false);
  });
});

describe("signature Telnyx (ed25519)", () => {
  it("accepte une requête signée récente, refuse altération et rejeu", () => {
    const { publicKey, privateKey } = generateKeyPairSync("ed25519");
    const raw = publicKey.export({ format: "der", type: "spki" }).subarray(-32);
    process.env.TELNYX_PUBLIC_KEY = raw.toString("base64");
    const body = "To=%2B33100000000&From=%2B33600000000";
    const ts = String(Math.floor(Date.now() / 1000));
    const sig = sign(null, Buffer.from(`${ts}|${body}`), privateKey).toString("base64");
    expect(verifyTelnyxSignature(body, sig, ts)).toBe(true);
    expect(verifyTelnyxSignature(body + "&x=1", sig, ts)).toBe(false);
    const old = String(Math.floor(Date.now() / 1000) - 3600);
    const oldSig = sign(null, Buffer.from(`${old}|${body}`), privateKey).toString("base64");
    expect(verifyTelnyxSignature(body, oldSig, old)).toBe(false);
  });
});

describe("instructions d'appel", () => {
  it("relie l'appel au serveur vocal avec le jeton, en XML échappé", () => {
    process.env.VOICE_SERVER_URL = "wss://voice.callpme.com";
    // Twilio : pas de paramètre dans l'URL du flux, jeton via <Parameter>.
    process.env.TELEPHONY_PROVIDER = "twilio";
    process.env.TWILIO_ACCOUNT_SID = "AC_test";
    process.env.TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || "secret";
    const xml = streamInstructions('a"b<c');
    expect(xml).toContain('<Stream url="wss://voice.callpme.com/ws/telephony">');
    expect(xml).toContain('<Parameter name="t" value="a&quot;b&lt;c"/>');
    expect(xml).toContain("<Hangup/>");
  });

  it("Telnyx : jeton dans l'URL et audio retour en µ-law", () => {
    const saved = { ...process.env };
    delete process.env.TWILIO_ACCOUNT_SID;
    process.env.TELEPHONY_PROVIDER = "telnyx";
    process.env.TELNYX_API_KEY = "KEY_test";
    process.env.VOICE_SERVER_URL = "wss://voice.callpme.com";
    const xml = streamInstructions('a"b<c');
    expect(xml).toContain('url="wss://voice.callpme.com/ws/telephony?t=a%22b%3Cc"');
    expect(xml).toContain('bidirectionalMode="rtp" bidirectionalCodec="PCMU"');
    process.env = saved;
  });

  it("normalise les numéros au format E.164", () => {
    expect(toE164("06 12 34 56 78")).toBe("+33612345678");
    expect(toE164("0033 6 12 34 56 78")).toBe("+33612345678");
    expect(toE164("+225 07 12 34 56 78")).toBe("+2250712345678");
    expect(toE164("abc")).toBeNull();
  });
});

describe("codec µ-law", () => {
  it("aller-retour fidèle à ±2 % près", () => {
    for (const v of [0, 100, -100, 1000, -8000, 16000, 32000, -32000]) {
      const back = mulawToLinear(linearToMulaw(v));
      expect(Math.abs(back - v)).toBeLessThanOrEqual(Math.max(16, Math.abs(v) * 0.04));
    }
    const pcm = new Int16Array([0, 500, -500, 12000]);
    expect(decodeMulaw(encodeMulaw(pcm)).length).toBe(4);
  });
});

import { consumeVoiceToken } from "@/lib/voice-engine/token";
import { createDownsampler } from "@/components/agents/downsample";
import { configSchema } from "@/lib/validation/agent";

describe("jeton à usage unique", () => {
  it("n'ouvre qu'une seule session par jeton", () => {
    const p = verifyVoiceToken(
      createVoiceToken({ callId: "c", agentId: "a", organizationId: "o", direction: "web", from: "x", to: "y" }),
    )!;
    expect(consumeVoiceToken(p)).toBe(true);
    expect(consumeVoiceToken(p)).toBe(false);
  });
});

describe("rééchantillonnage du micro", () => {
  for (const rate of [48000, 44100]) {
    it(`produit 8 000 échantillons par seconde depuis ${rate} Hz`, () => {
      const push = createDownsampler(rate);
      let total = 0;
      for (let i = 0; i < rate; i += 128) total += push(new Float32Array(Math.min(128, rate - i))).length;
      expect(Math.abs(total - 8000)).toBeLessThanOrEqual(1);
    });
  }
});

describe("numéro de transfert", () => {
  const parse = (n: string) => configSchema.shape.transferNumber.safeParse(n).success;
  it("accepte un numéro d'un pays couvert", () => expect(parse("+33 1 23 45 67 89")).toBe(true));
  it("refuse un numéro surtaxé ou hors zone", () => {
    expect(parse("+33 8 99 12 34 56")).toBe(false);
    expect(parse("+882 1234 5678")).toBe(false);
  });
});
