"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Ear, EarOff, Headphones, Loader2, PhoneForwarded, Radio, Send, WifiOff } from "lucide-react";
import type { LiveCallInfo, LiveTurn } from "@/lib/live/protocol";
import { WHISPER_MAX } from "@/lib/live/protocol";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type ServerMsg =
  | { type: "calls"; calls: LiveCallInfo[]; serverNow?: number }
  | { type: "transcript"; liveId: string; turns: LiveTurn[] }
  | { type: "turn"; liveId: string; turn: LiveTurn }
  | { type: "audio"; liveId: string; from: "caller" | "agent"; data: string }
  | { type: "ended"; liveId: string }
  | { type: "clear"; liveId: string }
  | { type: "result"; action: string; ok: boolean; message?: string };

/** Décodage µ-law (G.711) → échantillons flottants. */
function mulawToFloat(bytes: Uint8Array): Float32Array<ArrayBuffer> {
  const out = new Float32Array(new ArrayBuffer(bytes.length * 4));
  for (let i = 0; i < bytes.length; i++) {
    const u = ~bytes[i] & 0xff;
    const sign = u & 0x80;
    const exponent = (u >> 4) & 0x07;
    const mantissa = u & 0x0f;
    const sample = (((mantissa << 3) + 0x84) << exponent) - 0x84;
    out[i] = (sign ? -sample : sample) / 32768;
  }
  return out;
}

function duration(startedAt: number, now: number) {
  const s = Math.max(0, Math.floor((now - startedAt) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

const SPEAKER: Record<string, string> = { caller: "Appelant", agent: "Agent", system: "Supervision", tool: "Action" };

export function LiveMonitor() {
  const [status, setStatus] = useState<"connecting" | "open" | "closed" | "unavailable">("connecting");
  const [unavailable, setUnavailable] = useState("");
  const [canControl, setCanControl] = useState(false);
  const [calls, setCalls] = useState<LiveCallInfo[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [turns, setTurns] = useState<LiveTurn[]>([]);
  const [ended, setEnded] = useState(false);
  const [listening, setListening] = useState(false);
  const [whisper, setWhisper] = useState("");
  const [transferTo, setTransferTo] = useState("");
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const wsRef = useRef<WebSocket | null>(null);
  const selectedRef = useRef<string | null>(null);
  const audioRef = useRef<{ ctx: AudioContext; heads: Record<string, number>; sources: Set<AudioBufferSourceNode> } | null>(null);
  /** Décalage horloge navigateur − horloge du serveur vocal (durées d'appel justes). */
  const skewRef = useRef(0);
  const pendingRef = useRef<string | null>(null);
  pendingRef.current = pending;
  const scrollRef = useRef<HTMLDivElement | null>(null);
  selectedRef.current = selected;

  const send = useCallback((msg: unknown) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  }, []);

  const playAudio = useCallback((from: string, b64: string) => {
    const a = audioRef.current;
    if (!a) return;
    const raw = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const samples = mulawToFloat(raw);
    const buf = a.ctx.createBuffer(1, samples.length, 8000);
    buf.copyToChannel(samples, 0);
    const src = a.ctx.createBufferSource();
    src.buffer = buf;
    src.connect(a.ctx.destination);
    // Une tête de lecture par voix : appelant et agent se superposent comme au téléphone.
    // Marge de 150 ms contre la gigue du réseau.
    const start = Math.max(a.ctx.currentTime + 0.15, a.heads[from] ?? 0);
    src.start(start);
    a.heads[from] = start + buf.duration;
    a.sources.add(src);
    src.onended = () => a.sources.delete(src);
  }, []);

  /** Interruption côté appel : l'audio de l'agent déjà programmé n'est pas joué. */
  const clearAudio = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    a.sources.forEach((src) => {
      try {
        src.stop();
      } catch {
        /* déjà arrêtée */
      }
    });
    a.sources.clear();
    a.heads = {};
  }, []);

  const stopAudio = useCallback(() => {
    void audioRef.current?.ctx.close().catch(() => {});
    audioRef.current = null;
  }, []);

  // Connexion au serveur vocal, avec reconnexion (chaque jeton ne sert qu'une fois).
  useEffect(() => {
    let cancelled = false;
    let retry = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const connect = async () => {
      setStatus("connecting");
      let url = "";
      try {
        const res = await fetch("/api/live/token", { method: "POST" });
        const data = (await res.json().catch(() => ({}))) as { url?: string; canControl?: boolean; error?: string; message?: string };
        if (!res.ok || !data.url) {
          if (res.status === 403) {
            setUnavailable(data.error ?? data.message ?? "Supervision indisponible.");
            setStatus("unavailable");
            return;
          }
          throw new Error("token");
        }
        url = data.url;
        setCanControl(Boolean(data.canControl));
      } catch {
        if (!cancelled) timer = setTimeout(connect, Math.min(30_000, 2000 * 2 ** retry++));
        setStatus("closed");
        return;
      }
      if (cancelled) return;
      const ws = new WebSocket(url);
      wsRef.current = ws;
      ws.onopen = () => {
        retry = 0;
        setStatus("open");
        // Appel suivi avant la coupure : on s'y réabonne.
        if (selectedRef.current) ws.send(JSON.stringify({ type: "watch", liveId: selectedRef.current }));
      };
      ws.onmessage = (ev) => {
        let msg: ServerMsg;
        try {
          msg = JSON.parse(String(ev.data));
        } catch {
          return;
        }
        if (msg.type === "calls") {
          if (typeof msg.serverNow === "number") skewRef.current = Date.now() - msg.serverNow;
          setCalls(msg.calls);
        } else if (msg.type === "clear" && msg.liveId === selectedRef.current) clearAudio();
        if (msg.type === "transcript" && msg.liveId === selectedRef.current) setTurns(msg.turns);
        else if (msg.type === "turn" && msg.liveId === selectedRef.current) setTurns((t) => [...t, msg.turn]);
        else if (msg.type === "audio" && msg.liveId === selectedRef.current) playAudio(msg.from, msg.data);
        else if (msg.type === "ended" && msg.liveId === selectedRef.current) {
          setEnded(true);
          setListening(false);
          stopAudio();
        } else if (msg.type === "result") {
          if (msg.action === pendingRef.current) setPending(null);
          if (msg.message) setNotice({ ok: msg.ok, text: msg.message });
          if (msg.action === "listen" && !msg.ok) {
            setListening(false);
            stopAudio();
          }
        }
      };
      ws.onclose = () => {
        if (wsRef.current === ws) wsRef.current = null;
        setListening(false);
        setPending(null);
        stopAudio();
        if (cancelled) return;
        setStatus("closed");
        timer = setTimeout(connect, Math.min(30_000, 2000 * 2 ** retry++));
      };
    };
    void connect();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      wsRef.current?.close();
      stopAudio();
    };
  }, [playAudio, stopAudio, clearAudio]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns]);

  const open = (call: LiveCallInfo) => {
    if (selected === call.liveId) return;
    if (selected) send({ type: "unwatch", liveId: selected });
    // Mis à jour tout de suite : les messages encore en vol de l'appel précédent sont ignorés.
    selectedRef.current = call.liveId;
    stopAudio();
    setListening(false);
    setSelected(call.liveId);
    setTurns([]);
    setEnded(false);
    setNotice(null);
    setTransferTo(call.transferNumber ?? "");
    send({ type: "watch", liveId: call.liveId });
  };

  const toggleListen = () => {
    if (!selected) return;
    if (listening) {
      setListening(false);
      stopAudio();
      send({ type: "listen", liveId: selected, on: false });
      return;
    }
    // L'audio ne peut démarrer qu'après un geste de l'utilisateur.
    audioRef.current = { ctx: new AudioContext(), heads: {}, sources: new Set() };
    setListening(true);
    send({ type: "listen", liveId: selected, on: true });
  };

  const current = calls.find((c) => c.liveId === selected) ?? null;

  if (status === "unavailable") {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">
        <WifiOff className="mt-0.5 size-4 shrink-0" aria-hidden />
        <p>{unavailable}</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
      <section aria-labelledby="live-calls" className="rounded-xl border border-border bg-card">
        <header className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 id="live-calls" className="text-sm font-medium text-foreground">
            Appels en cours <span className="text-muted-foreground">({calls.length})</span>
          </h2>
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground" role="status">
            <span
              className={cn("size-2 rounded-full", status === "open" ? "bg-emerald-500" : "bg-amber-500")}
              aria-hidden
            />
            {status === "open" ? "Connecté" : "Connexion…"}
          </span>
        </header>
        {calls.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            Aucun appel en cours. Ils apparaissent ici dès qu&apos;un agent décroche.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {calls.map((c) => (
              <li key={c.liveId}>
                <button
                  type="button"
                  onClick={() => open(c)}
                  aria-pressed={selected === c.liveId}
                  className={cn(
                    "flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand/30",
                    selected === c.liveId ? "bg-brand/[0.06]" : "hover:bg-foreground/[0.03]",
                  )}
                >
                  <Radio className="size-4 shrink-0 text-emerald-600" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-foreground">{c.agentName}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {c.direction === "outbound" ? "Vers" : "De"} {c.party}
                    </span>
                  </span>
                  <span className="text-xs tabular-nums text-muted-foreground">{duration(c.startedAt, now - skewRef.current)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="live-detail" className="flex min-h-[420px] flex-col rounded-xl border border-border bg-card">
        {!selected ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center text-sm text-muted-foreground">
            <Headphones className="size-6" aria-hidden />
            <h2 id="live-detail" className="font-medium text-foreground">Choisissez un appel</h2>
            <p>La conversation s&apos;affiche en direct{canControl ? " ; vous pourrez écouter, souffler une consigne ou prendre la main." : "."}</p>
          </div>
        ) : (
          <>
            <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
              <h2 id="live-detail" className="text-sm font-medium text-foreground">
                {current ? `${current.agentName} · ${current.party}` : "Appel terminé"}
              </h2>
              {canControl && current && !ended && (
                <Button
                  type="button"
                  size="sm"
                  variant={listening ? "default" : "outline"}
                  onClick={toggleListen}
                  aria-pressed={listening}
                  disabled={status !== "open"}
                  title="Prévenez vos appelants que les appels peuvent être écoutés (message d'accueil)."
                >
                  {listening ? <EarOff aria-hidden /> : <Ear aria-hidden />} {listening ? "Arrêter l'écoute" : "Écouter"}
                </Button>
              )}
            </header>
            {canControl && current && !ended && (
              <p className="border-b border-border bg-amber-500/[0.06] px-4 py-2 text-xs text-muted-foreground">
                Écouter un appel suppose d&apos;en informer l&apos;appelant, par exemple dans le message d&apos;accueil :
                « cet appel peut être écouté pour la qualité du service ». Vos écoutes et reprises sont journalisées.
              </p>
            )}
            <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto px-4 py-3" aria-live="polite" aria-relevant="additions">
              {turns.length === 0 && <p className="text-sm text-muted-foreground">En attente des premiers échanges…</p>}
              {turns.map((t, i) => (
                <p
                  key={i}
                  className={cn(
                    "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                    t.speaker === "caller" && "bg-foreground/[0.05] text-foreground",
                    t.speaker === "agent" && "ml-auto bg-brand/[0.08] text-foreground",
                    (t.speaker === "system" || t.speaker === "tool") && "mx-auto bg-amber-500/10 text-xs text-muted-foreground",
                  )}
                >
                  <span className="mb-0.5 block text-[11px] font-medium text-muted-foreground">{SPEAKER[t.speaker] ?? t.speaker}</span>
                  {t.text}
                </p>
              ))}
              {ended && <p className="text-center text-xs text-muted-foreground">Appel terminé. Il est enregistré dans « Appels ».</p>}
            </div>

            {canControl && current && !ended && (
              <div className="space-y-3 border-t border-border p-4">
                <form
                  className="flex flex-col gap-2 sm:flex-row"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const text = whisper.trim();
                    if (!text || !selected) return;
                    setPending("whisper");
                    send({ type: "whisper", liveId: selected, text });
                    setWhisper("");
                  }}
                >
                  <label htmlFor="live-whisper" className="sr-only">Consigne pour l&apos;agent</label>
                  <Textarea
                    id="live-whisper"
                    rows={1}
                    maxLength={WHISPER_MAX}
                    value={whisper}
                    onChange={(e) => setWhisper(e.target.value)}
                    placeholder="Souffler une consigne à l'agent (l'appelant ne l'entend pas)"
                    className="min-h-10 flex-1"
                  />
                  <Button type="submit" variant="outline" disabled={!whisper.trim() || pending === "whisper"}>
                    {pending === "whisper" ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />} Souffler
                  </Button>
                </form>
                {current.canTakeOver && (
                  <form
                    className="flex flex-col gap-2 sm:flex-row"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!selected) return;
                      const to = transferTo.replace(/[\s.-]/g, "");
                      if (!window.confirm(`Transférer l'appel vers ${to || "le numéro de transfert de l'agent"} ?`)) return;
                      setPending("takeover");
                      send({ type: "takeover", liveId: selected, ...(to ? { to } : {}) });
                    }}
                  >
                    <label htmlFor="live-transfer" className="sr-only">Numéro vers lequel transférer</label>
                    <Input
                      id="live-transfer"
                      type="tel"
                      inputMode="tel"
                      value={transferTo}
                      onChange={(e) => setTransferTo(e.target.value)}
                      placeholder="+229 01 23 45 67 89"
                      className="flex-1"
                    />
                    <Button type="submit" disabled={pending === "takeover"}>
                      {pending === "takeover" ? <Loader2 className="animate-spin" aria-hidden /> : <PhoneForwarded aria-hidden />} Prendre la main
                    </Button>
                  </form>
                )}
                {notice && (
                  <p role={notice.ok ? "status" : "alert"} className={notice.ok ? "text-sm text-success" : "text-sm text-destructive"}>
                    {notice.text}
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
