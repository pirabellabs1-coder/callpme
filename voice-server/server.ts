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
 * Chaque session exige un jeton signé par l'application, à usage unique
 * (src/lib/voice-engine/token.ts). Telnyx et le navigateur le présentent dès la
 * connexion ; Twilio ne le transmet que dans le premier message (« start ») :
 * ces connexions restent dans une petite file d'attente bornée, quelques
 * secondes au plus, sans compter parmi les sessions.
 *
 * Lancement : npm run voice:dev (développement) / npm run voice:start (production).
 */
import http from "node:http";
import { WebSocketServer, type WebSocket, type RawData } from "ws";
import { consumeVoiceToken, verifyVoiceToken, type VoiceTokenPayload } from "../src/lib/voice-engine/token";
import { CallSession, type VoiceTransport } from "../src/lib/voice-engine/session";
import { transferCall } from "../src/lib/telephony/provider";
import { frames } from "../src/lib/voice-engine/audio";

// Sans secret robuste, les jetons seraient forgeables : on refuse de démarrer.
if (!process.env.NEXTAUTH_SECRET || process.env.NEXTAUTH_SECRET.length < 32) {
  console.error("[voice] NEXTAUTH_SECRET manquant ou trop court (32 caractères minimum, identique à l'application).");
  process.exit(1);
}

const PORT = Number(process.env.VOICE_SERVER_PORT || process.env.PORT || 4100);
const MAX_SESSIONS = Number(process.env.VOICE_MAX_SESSIONS || 50);
const MAX_PER_ORG = Number(process.env.VOICE_MAX_PER_ORG || 10);
/** Connexions téléphoniques en attente du message « start » (non authentifiées). */
const MAX_PENDING = Number(process.env.VOICE_MAX_PENDING || 20);
const MAX_PENDING_PER_IP = 5;
const START_TIMEOUT_MS = 5_000;

const sessions = new Set<CallSession>();
const perOrg = new Map<string, number>();
const pendingByIp = new Map<string, number>();
let pending = 0;

const server = http.createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }
  res.writeHead(404).end();
});

const wssTelephony = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });
const wssWeb = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });

function reject(socket: import("node:stream").Duplex, status: string) {
  socket.write(`HTTP/1.1 ${status}\r\n\r\n`);
  socket.destroy();
}

/** Réserve une place de session pour l'organisation (false = plus de place). */
function reserve(payload: VoiceTokenPayload): boolean {
  const org = perOrg.get(payload.organizationId) ?? 0;
  if (sessions.size >= MAX_SESSIONS || org >= MAX_PER_ORG) return false;
  perOrg.set(payload.organizationId, org + 1);
  return true;
}

function release(payload: VoiceTokenPayload) {
  const n = (perOrg.get(payload.organizationId) ?? 1) - 1;
  if (n <= 0) perOrg.delete(payload.organizationId);
  else perOrg.set(payload.organizationId, n);
}

/** Jeton valide, du bon type, jamais utilisé. */
function acceptToken(token: string | null | undefined, kind: "web" | "telephony"): VoiceTokenPayload | null {
  const payload = verifyVoiceToken(token);
  if (!payload) return null;
  if ((payload.direction === "web") !== (kind === "web")) return null;
  return consumeVoiceToken(payload) ? payload : null;
}

server.on("upgrade", (req, socket, head) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  const token = url.searchParams.get("t");

  if (url.pathname === "/ws/web") {
    const payload = acceptToken(token, "web");
    if (!payload) return reject(socket, "401 Unauthorized");
    if (!reserve(payload)) return reject(socket, "503 Service Unavailable");
    return wssWeb.handleUpgrade(req, socket, head, (ws) => onWeb(ws, payload));
  }

  if (url.pathname === "/ws/telephony") {
    // Telnyx : jeton dans l'URL, vérifié tout de suite.
    if (token) {
      const payload = acceptToken(token, "telephony");
      if (!payload) return reject(socket, "401 Unauthorized");
      if (!reserve(payload)) return reject(socket, "503 Service Unavailable");
      return wssTelephony.handleUpgrade(req, socket, head, (ws) => onTelephony(ws, payload, null));
    }
    // Twilio : jeton attendu dans « start ». File d'attente bornée (globale et par IP).
    const ip = req.socket.remoteAddress ?? "?";
    const fromIp = pendingByIp.get(ip) ?? 0;
    if (pending >= MAX_PENDING || fromIp >= MAX_PENDING_PER_IP) return reject(socket, "503 Service Unavailable");
    pending++;
    pendingByIp.set(ip, fromIp + 1);
    let left = false;
    const leave = () => {
      if (left) return;
      left = true;
      pending--;
      const n = (pendingByIp.get(ip) ?? 1) - 1;
      if (n <= 0) pendingByIp.delete(ip);
      else pendingByIp.set(ip, n);
    };
    socket.once("close", leave);
    return wssTelephony.handleUpgrade(req, socket, head, (ws) => onTelephony(ws, null, leave));
  }

  reject(socket, "404 Not Found");
});

/** Enregistre la session et libère sa place à la fin. */
function attach(ws: WebSocket, payload: VoiceTokenPayload, session: CallSession) {
  sessions.add(session);
  let closed = false;
  const done = () => {
    if (closed) return;
    closed = true;
    sessions.delete(session);
    release(payload);
  };
  ws.once("close", () => {
    void session.onTransportClosed().finally(done);
  });
}

/* -------------------------- Téléphonie (Twilio/Telnyx) -------------------------- */

function onTelephony(ws: WebSocket, preAuth: VoiceTokenPayload | null, leavePending: (() => void) | null) {
  let session: CallSession | null = null;
  let payload: VoiceTokenPayload | null = preAuth;
  let streamSid: string | undefined;
  let providerCallId: string | undefined;

  const transport: VoiceTransport = {
    sendAudio(mulaw) {
      if (ws.readyState !== ws.OPEN) return;
      for (const f of frames(mulaw)) {
        ws.send(JSON.stringify({ event: "media", ...(streamSid ? { streamSid } : {}), media: { payload: f.toString("base64") } }));
      }
    },
    clearAudio() {
      if (ws.readyState === ws.OPEN) ws.send(JSON.stringify({ event: "clear", ...(streamSid ? { streamSid } : {}) }));
    },
    hangup() {
      // Fermer le flux fait passer l'opérateur à l'instruction suivante : <Hangup/>.
      setTimeout(() => ws.close(), 200);
    },
    transfer: (to) => {
      if (!providerCallId || !payload) return Promise.resolve(false);
      // Appel non lié à l'émission du jeton (sortant) : on vérifie ses numéros.
      const expected = payload.providerCallId ? undefined : { from: payload.from, to: payload.to };
      return transferCall(providerCallId, to, expected);
    },
  };

  // Sans message « start » valide très vite, on coupe.
  const startTimeout = setTimeout(() => !session && ws.close(), START_TIMEOUT_MS);

  ws.on("message", (data: RawData) => {
    let msg: {
      event?: string;
      streamSid?: string;
      stream_id?: string;
      start?: {
        streamSid?: string;
        callSid?: string;
        call_control_id?: string;
        call_session_id?: string;
        customParameters?: Record<string, string>;
        custom_parameters?: Record<string, string>;
      };
      media?: { payload?: string; track?: string };
      dtmf?: { digit?: string };
    };
    try {
      msg = JSON.parse(data.toString());
    } catch {
      return;
    }

    if (msg.event === "start" && !session) {
      if (!payload) {
        const params = msg.start?.customParameters ?? msg.start?.custom_parameters;
        payload = acceptToken(params?.t, "telephony");
        if (!payload) return ws.close();
      }
      const announced = msg.start?.callSid ?? msg.start?.call_control_id;
      // Jeton lié à un appel précis (entrant) : le flux doit annoncer ce même appel.
      if (payload.providerCallId && announced !== payload.providerCallId) return ws.close();
      if (leavePending) {
        leavePending();
        leavePending = null;
        if (!reserve(payload)) return ws.close();
      }
      clearTimeout(startTimeout);
      streamSid = msg.start?.streamSid ?? msg.streamSid ?? msg.stream_id;
      providerCallId = announced;
      session = new CallSession(payload, transport);
      session.setProviderCallId(providerCallId);
      attach(ws, payload, session);
      void session.start().catch(() => ws.close());
      return;
    }
    if (msg.event === "media" && session && msg.media?.payload) {
      if (msg.media.track && msg.media.track !== "inbound" && msg.media.track !== "inbound_track") return;
      session.onAudio(Buffer.from(msg.media.payload, "base64"));
      return;
    }
    // Touches du clavier téléphonique (« tapez 1 »).
    if (msg.event === "dtmf" && session && msg.dtmf?.digit) {
      session.onDtmf(String(msg.dtmf.digit).slice(0, 1));
      return;
    }
    if (msg.event === "stop") ws.close();
  });

  ws.on("close", () => {
    clearTimeout(startTimeout);
    leavePending?.();
    // Jeton vérifié à la connexion mais aucun « start » : libérer la place réservée.
    if (!session && preAuth) release(preAuth);
  });
  ws.on("error", () => ws.close());
}

/* ------------------------------ Test navigateur ------------------------------ */

function onWeb(ws: WebSocket, payload: VoiceTokenPayload) {
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
  attach(ws, payload, session);
  void session.start().catch(() => ws.close());

  ws.on("message", (data: RawData, isBinary: boolean) => {
    if (isBinary) session.onAudio(Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer));
    else if (data.toString() === '{"type":"hangup"}') void session.end("completed");
  });
  ws.on("error", () => ws.close());
}

server.listen(PORT, () => {
  console.log(`[voice] Serveur vocal Callpme à l'écoute sur :${PORT} (max ${MAX_SESSIONS} sessions, ${MAX_PER_ORG} par organisation)`);
});

/* ------------------------------ Arrêt propre ------------------------------ */

let stopping = false;
for (const sig of ["SIGINT", "SIGTERM"] as const) {
  process.on(sig, () => {
    if (stopping) return;
    stopping = true;
    console.log(`[voice] Arrêt : enregistrement de ${sessions.size} appel(s) en cours…`);
    server.close();
    // Filet de sécurité si un enregistrement reste bloqué.
    setTimeout(() => process.exit(0), 15_000).unref();
    void Promise.allSettled(Array.from(sessions).map((s) => s.end("completed"))).then(() => {
      wssTelephony.clients.forEach((c) => c.close());
      wssWeb.clients.forEach((c) => c.close());
      process.exit(0);
    });
  });
}
