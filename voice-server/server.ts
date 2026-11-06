/**
 * Serveur vocal Callpme — remplace Vapi.
 *
 * Service Node séparé de l'application Next.js (Vercel ne garde pas de
 * WebSocket ouverts). Il réutilise le code de l'application (src/lib) :
 * mêmes agents, même cerveau, même base de données.
 *
 *  - /ws/telephony : flux audio Twilio / Telnyx (<Connect><Stream>), µ-law 8 kHz.
 *  - /ws/web       : test au micro depuis le tableau de bord (µ-law 8 kHz binaire).
 *  - /health       : sonde de disponibilité.
 *
 * Chaque connexion doit présenter un jeton signé par l'application
 * (src/lib/voice-engine/token.ts) ; sans lui, la connexion est refusée.
 *
 * Lancement : npm run voice:dev (développement) / npm run voice:start (production).
 */
import http from "node:http";
import { WebSocketServer, type WebSocket, type RawData } from "ws";
import { verifyVoiceToken, type VoiceTokenPayload } from "../src/lib/voice-engine/token";
import { CallSession, type VoiceTransport } from "../src/lib/voice-engine/session";
import { transferCall } from "../src/lib/telephony/provider";
import { frames } from "../src/lib/voice-engine/audio";

const PORT = Number(process.env.VOICE_SERVER_PORT || process.env.PORT || 4100);
const MAX_SESSIONS = Number(process.env.VOICE_MAX_SESSIONS || 50);
let active = 0;

const server = http.createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, activeSessions: active }));
    return;
  }
  res.writeHead(404).end();
});

const wssTelephony = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });
const wssWeb = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });

server.on("upgrade", (req, socket, head) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  if (active >= MAX_SESSIONS) {
    socket.write("HTTP/1.1 503 Service Unavailable\r\n\r\n");
    return socket.destroy();
  }
  if (url.pathname === "/ws/telephony") {
    wssTelephony.handleUpgrade(req, socket, head, (ws) => onTelephony(ws, url.searchParams.get("t")));
  } else if (url.pathname === "/ws/web") {
    const payload = verifyVoiceToken(url.searchParams.get("t"));
    if (!payload || payload.direction !== "web") {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      return socket.destroy();
    }
    wssWeb.handleUpgrade(req, socket, head, (ws) => onWeb(ws, payload));
  } else {
    socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
    socket.destroy();
  }
});

function track(ws: WebSocket) {
  active++;
  ws.once("close", () => active--);
}

/* -------------------------- Téléphonie (Twilio/Telnyx) -------------------------- */

function onTelephony(ws: WebSocket, queryToken: string | null) {
  track(ws);
  let session: CallSession | null = null;
  let streamSid: string | undefined;
  let providerCallId: string | undefined;

  const transport: VoiceTransport = {
    sendAudio(mulaw) {
      for (const f of frames(mulaw)) {
        ws.send(JSON.stringify({ event: "media", ...(streamSid ? { streamSid } : {}), media: { payload: f.toString("base64") } }));
      }
    },
    clearAudio() {
      ws.send(JSON.stringify({ event: "clear", ...(streamSid ? { streamSid } : {}) }));
    },
    hangup() {
      // Fermer le flux fait passer l'opérateur à l'instruction suivante : <Hangup/>.
      setTimeout(() => ws.close(), 200);
    },
    transfer: (to) => (providerCallId ? transferCall(providerCallId, to) : Promise.resolve(false)),
  };

  // Sans message « start » valide dans les 10 s, on coupe.
  const startTimeout = setTimeout(() => !session && ws.close(), 10_000);

  ws.on("message", (data: RawData) => {
    let msg: {
      event?: string;
      streamSid?: string;
      start?: { streamSid?: string; callSid?: string; call_control_id?: string; customParameters?: Record<string, string> };
      media?: { payload?: string; track?: string };
    };
    try {
      msg = JSON.parse(data.toString());
    } catch {
      return;
    }

    if (msg.event === "start" && !session) {
      const token = msg.start?.customParameters?.t ?? queryToken;
      const payload = verifyVoiceToken(token);
      if (!payload || payload.direction === "web") return ws.close();
      clearTimeout(startTimeout);
      streamSid = msg.start?.streamSid ?? msg.streamSid;
      providerCallId = msg.start?.callSid ?? msg.start?.call_control_id;
      session = new CallSession(payload, transport);
      session.setProviderCallId(providerCallId);
      void session.start().catch(() => ws.close());
      return;
    }
    if (msg.event === "media" && session && msg.media?.payload) {
      if (msg.media.track && msg.media.track !== "inbound") return;
      session.onAudio(Buffer.from(msg.media.payload, "base64"));
      return;
    }
    if (msg.event === "stop") ws.close();
  });

  ws.on("close", () => {
    clearTimeout(startTimeout);
    void session?.onTransportClosed();
  });
  ws.on("error", () => ws.close());
}

/* ------------------------------ Test navigateur ------------------------------ */

function onWeb(ws: WebSocket, payload: VoiceTokenPayload) {
  track(ws);
  const transport: VoiceTransport = {
    sendAudio(mulaw) {
      if (ws.readyState === ws.OPEN) ws.send(mulaw, { binary: true });
    },
    clearAudio() {
      if (ws.readyState === ws.OPEN) ws.send(JSON.stringify({ type: "clear" }));
    },
    hangup() {
      setTimeout(() => ws.close(), 200);
    },
    sendEvent(event) {
      if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(event));
    },
  };
  const session = new CallSession(payload, transport);
  void session.start().catch(() => ws.close());

  ws.on("message", (data: RawData, isBinary: boolean) => {
    if (isBinary) session.onAudio(Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer));
    else if (data.toString() === '{"type":"hangup"}') void session.end("completed");
  });
  ws.on("close", () => void session.onTransportClosed());
  ws.on("error", () => ws.close());
}

server.listen(PORT, () => {
  console.log(`[voice] Serveur vocal Callpme à l'écoute sur :${PORT} (max ${MAX_SESSIONS} sessions)`);
});

for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => {
    console.log("[voice] Arrêt : fermeture des connexions…");
    wssTelephony.clients.forEach((c) => c.close());
    wssWeb.clients.forEach((c) => c.close());
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 5000);
  });
}
