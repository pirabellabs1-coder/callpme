import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { connectIntegration } from "@/lib/db/integrations";
import { INTEGRATION_CATALOG } from "@/lib/integrations/catalog";
import { ok, badRequest, unauthorized, serverError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

const IDS = INTEGRATION_CATALOG.map((i) => i.id);
const schema = z.object({ provider: z.string() });

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();
    const body = await req.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success || !IDS.includes(parsed.data.provider)) {
      return badRequest("Intégration inconnue");
    }
    await connectIntegration(session.org.id, parsed.data.provider);
    return ok({ success: true });
  } catch {
    return serverError();
  }
}
