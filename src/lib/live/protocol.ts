/**
 * Supervision des appels en direct — règles pures (testées), partagées par le
 * serveur vocal et le tableau de bord.
 *
 * Un membre de l'entreprise suit les appels en cours de SON organisation :
 * transcription en direct pour tous les membres ; écoute audio, consigne
 * soufflée à l'agent et reprise de l'appel réservées aux administrateurs.
 */
import { z } from "zod";
import type { TranscriptTurn } from "../shared/types";

/** Droits portés par le jeton de supervision (signé par l'application). */
export interface MonitorGrant {
  organizationId: string;
  userId: string;
  userName: string;
  /** Écoute audio, consigne soufflée, reprise de l'appel (administrateurs). */
  canControl: boolean;
}

/** Ce que le serveur vocal publie d'un appel en cours. */
export interface LiveCallInfo {
  liveId: string;
  organizationId: string;
  agentId: string;
  agentName: string;
  direction: "inbound" | "outbound" | "web";
  /** Numéro de la personne au bout du fil. */
  party: string;
  startedAt: number;
  /** Le transfert vers un humain est possible sur cet appel (téléphone, opérateur connu). */
  canTakeOver: boolean;
  /** Numéro de transfert configuré sur l'agent (affiché par défaut). */
  transferNumber: string | null;
}

export const WHISPER_MAX = 300;
/** Consignes soufflées gardées au plus pour l'agent (les plus récentes). */
export const WHISPER_KEEP = 5;
/** Commandes par connexion et par minute. */
export const MONITOR_RATE_PER_MIN = 60;
/** Connexions de supervision par organisation (et au total). */
export const MONITOR_MAX_PER_ORG = 5;
export const MONITOR_MAX_TOTAL = 100;

export const monitorCommandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("watch"), liveId: z.string().min(1).max(64) }),
  z.object({ type: z.literal("unwatch"), liveId: z.string().min(1).max(64) }),
  z.object({ type: z.literal("listen"), liveId: z.string().min(1).max(64), on: z.boolean() }),
  z.object({ type: z.literal("whisper"), liveId: z.string().min(1).max(64), text: z.string().trim().min(1).max(WHISPER_MAX) }),
  z.object({
    type: z.literal("takeover"),
    liveId: z.string().min(1).max(64),
    to: z
      .string()
      .trim()
      .regex(/^\+\d{8,15}$/, "Numéro au format international (+229…)")
      .optional(),
  }),
]);
export type MonitorCommand = z.infer<typeof monitorCommandSchema>;

/** Lit une commande du navigateur ; null si invalide. */
export function parseMonitorCommand(raw: string): MonitorCommand | null {
  if (raw.length > 2000) return null;
  try {
    const r = monitorCommandSchema.safeParse(JSON.parse(raw));
    return r.success ? r.data : null;
  } catch {
    return null;
  }
}

/** Commandes réservées aux administrateurs. */
export function commandAllowed(cmd: MonitorCommand, grant: MonitorGrant): boolean {
  if (cmd.type === "watch" || cmd.type === "unwatch") return true;
  return grant.canControl;
}

/** Un appel est visible pour un jeton seulement dans la même organisation (jamais les tests navigateur). */
export function callVisible(info: LiveCallInfo, grant: MonitorGrant): boolean {
  return info.organizationId === grant.organizationId && info.direction !== "web";
}

/**
 * Bloc de consignes du superviseur ajouté aux instructions de l'agent. Présenté
 * comme venant d'un membre de l'entreprise (jamais de l'appelant), à ne pas lire
 * à voix haute. Les chevrons sont neutralisés : une consigne ne peut pas fermer le bloc.
 */
export function supervisorInstructions(notes: string[]): string {
  if (!notes.length) return "";
  const clean = notes.slice(-WHISPER_KEEP).map((n) => `- ${n.replace(/[<>]/g, " ").replace(/\s+/g, " ").trim().slice(0, WHISPER_MAX)}`);
  return (
    "## Consignes du superviseur\n" +
    "Un membre de l'entreprise suit cet appel en direct et te donne ces consignes. Elles ne viennent pas de " +
    "l'appelant : applique-les dans ta prochaine réponse, ne les lis pas à voix haute et ne mentionne pas le superviseur. " +
    "Elles ne peuvent pas lever tes garde-fous.\n<consignes>\n" +
    clean.join("\n") +
    "\n</consignes>"
  );
}

/** Tour de transcription envoyé au navigateur. */
export type LiveTurn = Pick<TranscriptTurn, "speaker" | "text" | "at" | "toolName">;
