import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { listCallsForExport, zonedParts } from "@/lib/db/calls";
import { unauthorized, serverError } from "@/lib/api/respond";
import {
  CALL_STATUS_LABELS,
  parseCallFilters,
} from "@/components/calls/call-filters";
import type { CallStatus } from "@/lib/shared/types";

export const dynamic = "force-dynamic";

const dateFmt = new Intl.DateTimeFormat("fr-FR", {
  timeZone: "Europe/Paris",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

/**
 * Échappe une cellule CSV (séparateur « ; », usage Excel FR) et neutralise
 * l'injection de formules (=, +, -, @, tabulation, retour chariot).
 */
function cell(value: string | number | null | undefined): string {
  let s = value == null ? "" : String(value);
  // Un numéro de téléphone (+33…) reste lisible ; tout autre début dangereux,
  // y compris précédé d'espaces ou de sauts de ligne, est neutralisé.
  if (!/^\+\d[\d ]*$/.test(s) && /^\s*[=+\-@\t\r\n|]/.test(s)) s = `'${s}`;
  return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** « budget : 300 | rappel : Oui » — données relevées sur une seule cellule. */
function extractedText(raw: string | null): string {
  if (!raw) return "";
  try {
    return Object.entries(JSON.parse(raw) as Record<string, unknown>)
      .filter(([, v]) => v !== null && v !== "")
      .map(([k, v]) => `${k} : ${typeof v === "boolean" ? (v ? "Oui" : "Non") : String(v)}`)
      .join(" | ");
  } catch {
    return "";
  }
}

/** GET /api/calls/export — CSV des appels filtrés de l'organisation. */
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();

    const filters = parseCallFilters(req.nextUrl.searchParams);
    const rows = await listCallsForExport(session.org.id, filters);

    const header = [
      "Date",
      "Agent",
      "Direction",
      "De",
      "Vers",
      "Statut",
      "Durée (s)",
      "Issue",
      "Satisfaction (1-5)",
      "Résumé",
      "Données relevées",
      "ID",
    ];
    const lines = [header.map(cell).join(";")];
    for (const r of rows) {
      lines.push(
        [
          dateFmt.format(r.createdAt),
          r.agentName,
          r.direction === "inbound" ? "Entrant" : "Sortant",
          r.fromNumber,
          r.toNumber,
          CALL_STATUS_LABELS[r.status as CallStatus] ?? r.status,
          r.durationSec,
          r.outcome,
          r.satisfaction,
          r.summary,
          extractedText(r.extracted),
          r.id,
        ]
          .map(cell)
          .join(";"),
      );
    }

    const stamp = zonedParts(new Date()).ymd; // date du jour, heure de Paris
    // BOM UTF-8 : Excel affiche correctement les accents.
    return new NextResponse(`﻿${lines.join("\r\n")}\r\n`, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="appels-${stamp}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return serverError();
  }
}
