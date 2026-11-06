import { NextRequest } from "next/server";
import { corsHeaders, widgetAccess, widgetJson } from "@/lib/widget/access";
import { WIDGET_DEFAULTS } from "@/lib/widget/widget";

export const dynamic = "force-dynamic";

export function OPTIONS(req: NextRequest) {
  return new Response(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

/** GET /api/widget/config?agent=… — apparence du bouton (public, domaines autorisés seulement). */
export async function GET(req: NextRequest) {
  const access = await widgetAccess(req, req.nextUrl.searchParams.get("agent"));
  if (!access.ok) return access.response;
  const w = { ...WIDGET_DEFAULTS, ...access.agent.config.widget };
  return widgetJson(
    { name: access.agent.name, label: w.label, color: w.color, position: w.position, preview: access.preview },
    200,
    access.origin,
  );
}
