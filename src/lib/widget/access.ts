/**
 * Accès public au widget : vérifie l'agent, son activation et l'origine de
 * la page, et prépare les en-têtes CORS. Depuis l'application elle-même
 * (aperçu dans le tableau de bord), le propriétaire connecté peut l'essayer
 * même si le widget n'est pas encore activé.
 */
import { NextRequest, NextResponse } from "next/server";
import { getAgentById } from "@/lib/db/agents";
import { getSession } from "@/lib/auth/session";
import type { Agent } from "@/lib/shared/types";
import { originAllowed, WIDGET_DEFAULTS } from "./widget";

export function corsHeaders(origin: string | null): Record<string, string> {
  return origin
    ? {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Max-Age": "600",
        Vary: "Origin",
      }
    : {};
}

export function widgetJson(body: unknown, status: number, origin: string | null) {
  return NextResponse.json(body, { status, headers: corsHeaders(origin) });
}

export type WidgetAccess =
  | { ok: true; agent: Agent; origin: string; host: string; preview: boolean }
  | { ok: false; response: NextResponse };

/** Origine de l'application (aperçu depuis le tableau de bord). */
function isAppOrigin(req: NextRequest, origin: string): boolean {
  return origin === req.nextUrl.origin || (!!process.env.PUBLIC_URL && origin === new URL(process.env.PUBLIC_URL).origin);
}

export async function widgetAccess(req: NextRequest, agentId: string | null | undefined): Promise<WidgetAccess> {
  const origin = req.headers.get("origin");
  // Réponse volontairement identique pour un agent inconnu, désactivé ou un site non autorisé.
  const refused = (status = 404) =>
    ({ ok: false, response: widgetJson({ error: "Assistant indisponible sur ce site." }, status, origin) }) as const;
  if (!origin || !agentId || !/^[a-z0-9]{10,40}$/i.test(agentId)) return refused(400);

  const agent = await getAgentById(agentId);
  if (!agent) return refused();
  const widget = { ...WIDGET_DEFAULTS, ...agent.config.widget };
  let host: string;
  try {
    host = new URL(origin).hostname;
  } catch {
    return refused(400);
  }

  if (isAppOrigin(req, origin)) {
    const session = await getSession();
    if (session?.org.id === agent.organizationId) return { ok: true, agent, origin, host, preview: true };
  }
  if (!widget.enabled || agent.status !== "active" || !originAllowed(origin, widget.allowedDomains)) return refused();
  return { ok: true, agent, origin, host, preview: false };
}
