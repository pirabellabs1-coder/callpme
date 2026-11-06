/**
 * Lecture/validation des filtres de la liste d'appels depuis l'URL.
 * Partagé entre la page /calls et l'export CSV pour garantir le même jeu
 * de résultats. Module pur (utilisable côté serveur et client).
 */
import type { CallDirection, CallStatus } from "@/lib/shared/types";

export const CALL_STATUSES: CallStatus[] = [
  "completed",
  "transferred",
  "failed",
  "missed",
  "in_progress",
];
export const CALL_DIRECTIONS: CallDirection[] = ["inbound", "outbound"];

export const CALL_STATUS_LABELS: Record<CallStatus, string> = {
  completed: "Résolu",
  transferred: "Transféré",
  failed: "Échec",
  missed: "Manqué",
  in_progress: "En cours",
};

export interface CallFilters {
  agentId?: string;
  status?: CallStatus;
  direction?: CallDirection;
  search?: string;
  from?: string;
  to?: string;
}

const YMD = /^\d{4}-\d{2}-\d{2}$/;

type ParamSource = URLSearchParams | Record<string, string | string[] | undefined>;

function read(sp: ParamSource, key: string): string | undefined {
  const v = sp instanceof URLSearchParams ? sp.get(key) : sp[key];
  const s = Array.isArray(v) ? v[0] : v;
  return s?.trim() || undefined;
}

export function parseCallFilters(sp: ParamSource): CallFilters {
  const status = read(sp, "status");
  const direction = read(sp, "direction");
  let from = read(sp, "from");
  let to = read(sp, "to");
  if (from && !YMD.test(from)) from = undefined;
  if (to && !YMD.test(to)) to = undefined;
  // Plage inversée : on remet dans l'ordre plutôt que de renvoyer zéro résultat.
  if (from && to && from > to) [from, to] = [to, from];

  return {
    agentId: read(sp, "agentId"),
    status:
      status && CALL_STATUSES.includes(status as CallStatus)
        ? (status as CallStatus)
        : undefined,
    direction:
      direction && CALL_DIRECTIONS.includes(direction as CallDirection)
        ? (direction as CallDirection)
        : undefined,
    search: read(sp, "search")?.slice(0, 100),
    from,
    to,
  };
}

/** Sérialise les filtres actifs en query string (sans pagination). */
export function filtersToQuery(f: CallFilters): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) if (v) sp.set(k, v);
  return sp.toString();
}
