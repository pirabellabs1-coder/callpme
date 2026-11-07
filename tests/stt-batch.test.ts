import { describe, expect, it, vi } from "vitest";
import { encodeMulaw, parseWav, resampleTo8k, wavFromPcm16 } from "@/lib/voice-engine/audio";
import { openUtteranceStt } from "@/lib/voice-engine/stt-batch";

/** `ms` millisecondes de µ-law 8 kHz : sinus audible (parole) ou silence. */
function tone(ms: number, amplitude = 8000): Buffer {
  const n = (ms / 1000) * 8000;
  const pcm = new Int16Array(n);
  for (let i = 0; i < n; i++) pcm[i] = Math.round(amplitude * Math.sin((2 * Math.PI * 300 * i) / 8000));
  return encodeMulaw(pcm);
}
const silence = (ms: number) => tone(ms, 0);
const flush = () => new Promise((r) => setTimeout(r, 0));

describe("audio : WAV et rééchantillonnage", () => {
  it("un WAV produit se relit à l'identique", () => {
    const pcm = new Int16Array([0, 1000, -1000, 32767, -32768]);
    const back = parseWav(wavFromPcm16(pcm, 16000));
    expect(back?.sampleRate).toBe(16000);
    expect(Array.from(back!.pcm)).toEqual(Array.from(pcm));
  });

  it("refuse ce qui n'est pas un WAV PCM 16 bits mono", () => {
    expect(parseWav(Buffer.from("pas un wav du tout"))).toBeNull();
  });

  it("24 kHz -> 8 kHz divise la longueur par 3 et garde le signal", () => {
    const pcm = new Int16Array(2400).fill(1200);
    const out = resampleTo8k(pcm, 24000);
    expect(out.length).toBe(800);
    expect(out[400]).toBe(1200);
  });
});

describe("transcription par phrase (fournisseurs sans streaming)", () => {
  it("détecte la parole, envoie la phrase à la fin du silence, puis signale la fin du tour", async () => {
    const transcribe = vi.fn(async (wav: Buffer) => {
      expect(wav.toString("ascii", 0, 4)).toBe("RIFF");
      return " Ẹ káàárọ̀ ";
    });
    const events = { onSpeechStarted: vi.fn(), onTranscript: vi.fn(), onUtteranceEnd: vi.fn(), onError: vi.fn() };
    const stt = openUtteranceStt(transcribe, events);

    stt.send(silence(300));
    expect(events.onSpeechStarted).not.toHaveBeenCalled();
    stt.send(tone(600));
    expect(events.onSpeechStarted).toHaveBeenCalledTimes(1);
    expect(transcribe).not.toHaveBeenCalled();
    stt.send(silence(800));
    await flush();

    expect(transcribe).toHaveBeenCalledTimes(1);
    expect(events.onTranscript).toHaveBeenCalledWith("Ẹ káàárọ̀", true);
    expect(events.onUtteranceEnd).toHaveBeenCalledTimes(1);
    stt.close();
  });

  it("ignore un bruit trop bref", async () => {
    const transcribe = vi.fn(async () => "x");
    const stt = openUtteranceStt(transcribe, {});
    stt.send(tone(80));
    stt.send(silence(900));
    await flush();
    expect(transcribe).not.toHaveBeenCalled();
  });

  it("coupe une phrase trop longue sans attendre le silence", async () => {
    const transcribe = vi.fn(async () => "longue phrase");
    const stt = openUtteranceStt(transcribe, {}, { maxUtteranceMs: 1000 });
    stt.send(tone(1500));
    await flush();
    expect(transcribe).toHaveBeenCalledTimes(1);
  });

  it("après close(), plus rien n'est émis et la requête en cours est annulée", async () => {
    let signal: AbortSignal | null = null;
    const transcribe = vi.fn((_wav: Buffer, s: AbortSignal) => {
      signal = s;
      return new Promise<string>((r) => setTimeout(() => r("trop tard"), 10));
    });
    const onTranscript = vi.fn();
    const stt = openUtteranceStt(transcribe, { onTranscript });
    stt.send(tone(500));
    stt.send(silence(800));
    await flush();
    stt.close();
    await new Promise((r) => setTimeout(r, 20));
    expect(signal!.aborted).toBe(true);
    expect(onTranscript).not.toHaveBeenCalled();
  });

  it("une erreur du fournisseur remonte par onError", async () => {
    const onError = vi.fn();
    const stt = openUtteranceStt(async () => Promise.reject(new Error("HTTP 500")), { onError });
    stt.send(tone(500));
    stt.send(silence(800));
    await flush();
    await flush();
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: "HTTP 500" }));
  });
});

describe("transcription par phrase : cas relevés en revue", () => {
  it("un bruit bref en plein appel (après du silence) n'est pas envoyé", async () => {
    const transcribe = vi.fn(async () => "x");
    const stt = openUtteranceStt(transcribe, {});
    stt.send(silence(500));
    stt.send(tone(80));
    stt.send(silence(900));
    await flush();
    expect(transcribe).not.toHaveBeenCalled();
  });

  it("un fournisseur qui ne répond jamais ne bloque pas la phrase suivante", async () => {
    let n = 0;
    const transcribe = vi.fn((_wav: Buffer, signal: AbortSignal) => {
      n++;
      if (n === 1) {
        return new Promise<string>((_r, reject) => signal.addEventListener("abort", () => reject(new Error("délai dépassé"))));
      }
      return Promise.resolve("deuxième phrase");
    });
    const onTranscript = vi.fn();
    const onError = vi.fn();
    const stt = openUtteranceStt(transcribe, { onTranscript, onError }, { timeoutMs: 30 });
    stt.send(tone(500));
    stt.send(silence(800));
    stt.send(tone(500));
    stt.send(silence(800));
    await new Promise((r) => setTimeout(r, 80));
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onTranscript).toHaveBeenCalledWith("deuxième phrase", true);
    stt.close();
  });
});
