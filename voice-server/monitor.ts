/**
 * Canal de supervision en direct (/ws/monitor) du serveur vocal.
 *
 * Le navigateur présente un jeton de supervision (src/lib/live/token.ts) :
 * il ne voit que les appels de son organisation. Messages envoyés :
 *  - { type: "calls", calls }               liste des appels en cours (toutes les 2 s si elle change) ;
 *  - { type: "transcript", liveId, turns }  transcription complète à l'abonnement ;
 *  - { type: "turn", liveId, turn }         nouveau tour ;
 *  - { type: "audio", liveId, from, data }  audio µ-law en base64 (écoute, administrateurs) ;
 *  - { type: "ended", liveId } ; { type: "result", action, ok, message }.
 */
import type { WebSocket, RawData } from "ws";
import type { CallSession } from "../src/lib/voice-engine/session";
import {
  callVisible,
  commandAllowed,
  MONITOR_MAX_PER_ORG,
  MONITOR_MAX_TOTAL,
  MONITOR_RATE_PER_MIN,
  parseMonitorCommand,
  type LiveCallInfo,
  type MonitorGrant,
} from "../src/lib/live/protocol";

const perOrg = new Map<string, number>();
let total = 0;
/** Au-delà, l'envoi d'audio est suspendu (connexion lente) plutôt que de remplir la mémoire. */
const MAX_BUFFERED = 512 * 1024;
/** Durée maximale d'une connexion : les droits du jeton sont revus à la reconnexion (le client se reconnecte seul). */
const MAX_CONNECTION_MS = 15 * 60_000;
/** Battement de cœur : une connexion qui ne répond plus est fermée (sa place est libérée). */
const PING_MS = 30_000;

/** Journal d'audit des actions de supervision (journaux du serveur vocal). */
function audit(grant: MonitorGrant, action: string, liveId: string, extra: Record<string, unknown> = {}) {
  console.log(
    "[voice] supervision " +
      JSON.stringify({ at: new Date().toISOString(), org: grant.organizationId, user: grant.userId, action, liveId, ...extra }),
  );
}

/** Place pour une connexion de supervision de cette organisation ? */
export function reserveMonitor(orgId: string): boolean {
  const n = perOrg.get(orgId) ?? 0;
  if (total >= MONITOR_MAX_TOTAL || n >= MONITOR_MAX_PER_ORG) return false;
  perOrg.set(orgId, n + 1);
  total++;
  return true;
}

function releaseMonitor(orgId: string) {
  const n = (perOrg.get(orgId) ?? 1) - 1;
  if (n <= 0) perOrg.delete(orgId);
  else perOrg.set(orgId, n);
  total--;
}

export function onMonitor(ws: WebSocket, grant: MonitorGrant, sessions: Set<CallSession>) {
  const watching = new Map<string, () => void>();
  const listening = new Set<string>();
  let lastList = "";
  let commands = 0;
  let takingOver = false;
  const rateTimer = setInterval(() => (commands = 0), 60_000);
  const lifeTimer = setTimeout(() => ws.close(4000, "Reconnexion"), MAX_CONNECTION_MS);
  let alive = true;
  ws.on("pong", () => (alive = true));
  const pingTimer = setInterval(() => {
    if (!alive) return ws.terminate();
    alive = false;
    ws.ping();
  }, PING_MS);

  const send = (msg: unknown) => {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
  };

  const visible = (): { info: LiveCallInfo; session: CallSession }[] => {
    const out: { info: LiveCallInfo; session: CallSession }[] = [];
    sessions.forEach((session) => {
      const info = session.liveInfo();
      if (info && callVisible(info, grant)) out.push({ info, session });
    });
    return out;
  };
  const find = (liveId: string) => visible().find((c) => c.info.liveId === liveId) ?? null;

  const pushList = () => {
    const calls = visible().map((c) => c.info);
    const json = JSON.stringify(calls);
    if (json === lastList) return;
    lastList = json;
    // Heure du serveur : le navigateur calcule les durées sans dépendre de sa propre horloge.
    send({ type: "calls", calls, serverNow: Date.now() });
  };
  pushList();
  const listTimer = setInterval(pushList, 2000);

  const unwatch = (liveId: string) => {
    watching.get(liveId)?.();
    watching.delete(liveId);
    listening.delete(liveId);
  };

  ws.on("message", (data: RawData, isBinary: boolean) => {
    if (isBinary || ++commands > MONITOR_RATE_PER_MIN) return;
    const cmd = parseMonitorCommand(data.toString());
    if (!cmd) return send({ type: "result", action: "?", ok: false, message: "Commande invalide." });
    if (!commandAllowed(cmd, grant)) {
      return send({ type: "result", action: cmd.type, ok: false, message: "Réservé aux administrateurs de l'organisation." });
    }
    const call = find(cmd.liveId);
    if (!call) {
      if (cmd.type === "unwatch") return unwatch(cmd.liveId);
      return send({ type: "result", action: cmd.type, ok: false, message: "Cet appel est terminé." });
    }
    const { session, info } = call;

    switch (cmd.type) {
      case "watch": {
        if (watching.has(info.liveId)) return;
        if (watching.size >= 10) return send({ type: "result", action: "watch", ok: false, message: "Trop d'appels ouverts à la fois." });
        send({ type: "transcript", liveId: info.liveId, turns: session.liveTranscript() });
        const stop = session.observe({
          turn: (turn) => send({ type: "turn", liveId: info.liveId, turn }),
          audio: (from, mulaw) => {
            if (!listening.has(info.liveId) || ws.bufferedAmount > MAX_BUFFERED) return;
            send({ type: "audio", liveId: info.liveId, from, data: mulaw.toString("base64") });
          },
          clear: () => {
            if (listening.has(info.liveId)) send({ type: "clear", liveId: info.liveId });
          },
          ended: () => {
            send({ type: "ended", liveId: info.liveId });
            watching.delete(info.liveId);
            listening.delete(info.liveId);
          },
        });
        watching.set(info.liveId, stop);
        return;
      }
      case "unwatch":
        return unwatch(info.liveId);
      case "listen":
        if (!watching.has(info.liveId)) return send({ type: "result", action: "listen", ok: false, message: "Ouvrez d'abord l'appel." });
        if (cmd.on) listening.add(info.liveId);
        else listening.delete(info.liveId);
        audit(grant, cmd.on ? "listen" : "listen_off", info.liveId);
        return send({ type: "result", action: "listen", ok: true });
      case "whisper":
        audit(grant, "whisper", info.liveId, { length: cmd.text.length });
        session.whisper(cmd.text, grant.userName);
        return send({ type: "result", action: "whisper", ok: true, message: "Consigne transmise à l'agent." });
      case "takeover":
        if (!info.canTakeOver) {
          return send({ type: "result", action: "takeover", ok: false, message: "Reprise impossible sur cet appel (pas de transfert téléphonique)." });
        }
        if (!cmd.to && !info.transferNumber) {
          return send({ type: "result", action: "takeover", ok: false, message: "Indiquez le numéro vers lequel transférer." });
        }
        if (takingOver) return send({ type: "result", action: "takeover", ok: false, message: "Reprise déjà en cours." });
        takingOver = true;
        audit(grant, "takeover", info.liveId, { to: cmd.to ?? info.transferNumber });
        void session
          .supervisorTakeover(grant.userName, cmd.to)
          .then((ok) => {
            audit(grant, ok ? "takeover_ok" : "takeover_failed", info.liveId);
            send({
              type: "result",
              action: "takeover",
              ok,
              message: ok ? "Appel transféré." : "Transfert refusé (destination, crédit ou opérateur).",
            });
          })
          .catch(() => send({ type: "result", action: "takeover", ok: false, message: "Transfert impossible." }))
          .finally(() => (takingOver = false));
        return;
    }
  });

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    clearInterval(listTimer);
    clearInterval(rateTimer);
    clearInterval(pingTimer);
    clearTimeout(lifeTimer);
    watching.forEach((stop) => stop());
    watching.clear();
    releaseMonitor(grant.organizationId);
  };
  ws.on("close", close);
  ws.on("error", () => ws.close());
}
