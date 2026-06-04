import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { connectIntegration } from "@/lib/db/integrations";
import { INTEGRATION_CATALOG, getIntegration } from "@/lib/integrations/catalog";
import { ok, badRequest, unauthorized, serverError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

const IDS = INTEGRATION_CATALOG.map((i) => i.id);
const schema = z.object({
  provider: z.string(),
  accountName: z.string().max(120).optional(),
  credentials: z.record(z.string(), z.string().max(4000)).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();
    const body = await req.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success || !IDS.includes(parsed.data.provider)) {
      return badRequest("Intégration inconnue");
    }
    const info = getIntegration(parsed.data.provider)!;
    const creds = parsed.data.credentials ?? {};

    // Vérifie que les identifiants requis sont bien fournis (vraie connexion).
    const missing = info.fields
      .filter((f) => f.required && !creds[f.key]?.trim())
      .map((f) => f.label);
    if (missing.length) {
      return badRequest(`Identifiants requis manquants : ${missing.join(", ")}`);
    }

    await connectIntegration(session.org.id, parsed.data.provider, {
      accountName: parsed.data.accountName,
      credentials: creds,
    });
    return ok({ success: true, accountName: parsed.data.accountName ?? null });
  } catch {
    return serverError();
  }
}
