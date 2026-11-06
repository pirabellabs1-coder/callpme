"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Mic, PhoneOff } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Test vocal en direct : l'utilisateur parle à son agent avec son micro, via
 * le moteur vocal Callpme (le même que pour les vrais appels). L'audio
 * circule en µ-law 8 kHz, comme au téléphone, pour un test représentatif.
 */

type Line = { speaker: "agent" | "caller" | "tool"; text: string };
type Status = "idle" | "connecting" | "live" | "ended" | "error";

/* ---------------------------- Codec µ-law ---------------------------- */

function linearToMulaw(sample: number): number {
  const BIAS = 0x84;
  let s = Math.max(-32635, Math.min(32635, Math.round(sample * 32767)));
  const sign = s < 0 ? 0x80 : 0;
  if (sign) s = -s;
  s += BIAS;
  let exponent = 7;
  for (let mask = 0x4000; (s & mask) === 0 && exponent > 0; mask >>= 1) exponent--;
  const mantissa = (s >> (exponent + 3)) & 0x0f;
  return ~(sign | (exponent << 4) | mantissa) & 0xff;
}

function mulawToFloat(byte: number): number {
  const u = ~byte & 0xff;
  const exponent = (u >> 4) & 0x07;
  const magnitude = ((((u & 0x0f) << 3) + 0x84) << exponent) - 0x84;
  return ((u & 0x80) ? -magnitude : magnitude) / 32768;
}

/** Processeur audio : remonte les échantillons du micro au fil de l'eau. */
const WORKLET = `
class Capture extends AudioWorkletProcessor {
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (ch) this.port.postMessage(ch.slice(0));
    return true;
  }
}
registerProcessor("callpme-capture", Capture);
`;

export function VoiceTestPanel({ agentId, agentName }: { agentId: string; agentName: string }) {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [interim, setInterim] = useState("");
  const [agentSpeaking, setAgentSpeaking] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const playheadRef = useRef(0);
  const sourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const logRef = useRef<HTMLOListElement>(null);

  useEffect(() => () => stop(), []); // nettoyage au démontage

  useEffect(() => {
    logRef.current?.lastElementChild?.scrollIntoView({ block: "nearest" });
  }, [lines, interim]);

  function play(bytes: Uint8Array) {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const buffer = ctx.createBuffer(1, bytes.length, 8000);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bytes.length; i++) data[i] = mulawToFloat(bytes[i]);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination);
    const at = Math.max(ctx.currentTime + 0.02, playheadRef.current);
    src.start(at);
    playheadRef.current = at + buffer.duration;
    sourcesRef.current.push(src);
    src.onended = () => {
      sourcesRef.current = sourcesRef.current.filter((s) => s !== src);
      if (sourcesRef.current.length === 0) setAgentSpeaking(false);
    };
    setAgentSpeaking(true);
  }

  function clearPlayback() {
    sourcesRef.current.forEach((s) => {
      try {
        s.stop();
      } catch {
        /* déjà arrêté */
      }
    });
    sourcesRef.current = [];
    playheadRef.current = 0;
    setAgentSpeaking(false);
  }

  async function start() {
    setError(null);
    setLines([]);
    setInterim("");
    setStatus("connecting");
    try {
      const res = await fetch(`/api/agents/${agentId}/voice-session`, { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? "Session vocale indisponible.");

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
      });
      streamRef.current = stream;
      const ctx = new AudioContext();
      ctxRef.current = ctx;
      const moduleUrl = URL.createObjectURL(new Blob([WORKLET], { type: "application/javascript" }));
      await ctx.audioWorklet.addModule(moduleUrl);
      URL.revokeObjectURL(moduleUrl);

      const ws = new WebSocket(body.url as string);
      ws.binaryType = "arraybuffer";
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus("live");
        const source = ctx.createMediaStreamSource(stream);
        const node = new AudioWorkletNode(ctx, "callpme-capture");
        // Rééchantillonnage vers 8 kHz (moyenne) + µ-law, envoi par trames de 20 ms.
        const ratio = ctx.sampleRate / 8000;
        let carry: number[] = [];
        node.port.onmessage = (e: MessageEvent<Float32Array>) => {
          const input = e.data;
          for (let i = 0; i + ratio <= input.length; i += ratio) {
            let sum = 0;
            const end = Math.floor(i + ratio);
            for (let j = Math.floor(i); j < end; j++) sum += input[j];
            carry.push(sum / Math.max(1, end - Math.floor(i)));
          }
          while (carry.length >= 160) {
            const frame = new Uint8Array(160);
            for (let k = 0; k < 160; k++) frame[k] = linearToMulaw(carry[k]);
            carry = carry.slice(160);
            if (ws.readyState === WebSocket.OPEN) ws.send(frame);
          }
        };
        source.connect(node);
      };

      ws.onmessage = (e) => {
        if (e.data instanceof ArrayBuffer) return play(new Uint8Array(e.data));
        let msg: { type: string; text?: string; final?: boolean; message?: string; turn?: Line };
        try {
          msg = JSON.parse(e.data as string);
        } catch {
          return;
        }
        if (msg.type === "clear" || msg.type === "interrupted") clearPlayback();
        if (msg.type === "transcript") {
          if (msg.final) {
            setInterim("");
            setLines((l) => {
              const last = l[l.length - 1];
              // Les segments finaux d'une même phrase sont regroupés.
              if (last?.speaker === "caller") return [...l.slice(0, -1), { speaker: "caller", text: `${last.text} ${msg.text}` }];
              return [...l, { speaker: "caller", text: msg.text ?? "" }];
            });
          } else setInterim(msg.text ?? "");
        }
        if (msg.type === "turn" && msg.turn) setLines((l) => [...l, msg.turn as Line]);
        if (msg.type === "error") setError(msg.message ?? "Erreur du moteur vocal.");
        if (msg.type === "ended") setStatus("ended");
      };
      ws.onerror = () => setError("Connexion au serveur vocal impossible.");
      ws.onclose = () => {
        teardown();
        setStatus((s) => (s === "error" ? s : "ended"));
      };
    } catch (e) {
      teardown();
      setStatus("error");
      setError(
        e instanceof DOMException && e.name === "NotAllowedError"
          ? "Accès au micro refusé. Autorisez le micro dans votre navigateur pour tester l'agent."
          : e instanceof Error
            ? e.message
            : "Session vocale indisponible.",
      );
    }
  }

  function teardown() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    clearPlayback();
    void ctxRef.current?.close().catch(() => {});
    ctxRef.current = null;
  }

  function stop() {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "hangup" }));
    else ws?.close();
    wsRef.current = null;
    teardown();
  }

  const live = status === "live";

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[0.95rem] font-semibold tracking-tight">Parler à l'agent</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Conversation vocale réelle avec {agentName}, au micro, avec le même moteur qu'au téléphone.
          </p>
        </div>
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs",
            live ? "bg-success/15 text-success" : "bg-foreground/5 text-muted-foreground",
          )}
        >
          <span className={cn("size-1.5 rounded-full", live ? "bg-success" : "bg-muted-foreground")} aria-hidden />
          {live ? (agentSpeaking ? "L'agent parle" : "À l'écoute") : status === "connecting" ? "Connexion…" : "Hors ligne"}
        </span>
      </div>

      <ol
        ref={logRef}
        aria-live="polite"
        aria-label="Transcription de la conversation"
        className="mt-4 max-h-72 space-y-2 overflow-y-auto rounded-xl border border-border bg-background/50 p-3 text-sm"
      >
        {lines.length === 0 && !interim && (
          <li className="py-6 text-center text-muted-foreground">
            {live ? "Parlez, l'agent vous écoute." : "Lancez le test, puis parlez normalement."}
          </li>
        )}
        {lines.map((l, i) =>
          l.speaker === "tool" ? (
            <li key={i} className="text-center text-xs text-muted-foreground">
              {l.text}
            </li>
          ) : (
            <li
              key={i}
              className={cn(
                "max-w-[85%] rounded-2xl px-3 py-2",
                l.speaker === "agent" ? "bg-foreground/[0.06]" : "ml-auto bg-brand/15",
              )}
            >
              <span className="sr-only">{l.speaker === "agent" ? "Agent : " : "Vous : "}</span>
              {l.text}
            </li>
          ),
        )}
        {interim && (
          <li className="ml-auto max-w-[85%] rounded-2xl bg-brand/10 px-3 py-2 italic text-muted-foreground">{interim}</li>
        )}
      </ol>

      {error && (
        <p role="alert" className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="mt-4 flex justify-end">
        {live || status === "connecting" ? (
          <Button variant="destructive" onClick={stop} disabled={status === "connecting"}>
            {status === "connecting" ? <Loader2 className="animate-spin" aria-hidden /> : <PhoneOff aria-hidden />}
            {status === "connecting" ? "Connexion…" : "Raccrocher"}
          </Button>
        ) : (
          <Button variant="brand" onClick={start}>
            <Mic aria-hidden />
            {status === "ended" ? "Relancer le test" : "Démarrer le test vocal"}
          </Button>
        )}
      </div>
      {status === "ended" && (
        <p className="mt-3 text-xs text-muted-foreground">
          Appel terminé : il apparaît dans l'historique des appels avec sa transcription et son résumé.
        </p>
      )}
    </Card>
  );
}
