import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { createClient } from "@/lib/db/clients";
import { created, badRequest, unauthorized, serverError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

const schema = z.object({
  name: z.string().min(1).max(80),
  brandColor: z.string().max(20).optional(),
  contactEmail: z.string().email().max(120).optional().or(z.literal("")),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();
    const body = await req.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest("Données invalides");
    const client = await createClient(session.org.id, {
      name: parsed.data.name.trim(),
      brandColor: parsed.data.brandColor,
      contactEmail: parsed.data.contactEmail || undefined,
    });
    return created({ client });
  } catch {
    return serverError();
  }
}
