import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { generateApiKey } from "@/lib/auth/api-key";
import {
  ok,
  created,
  badRequest,
  unauthorized,
  serverError,
} from "@/lib/api/respond";

export const dynamic = "force-dynamic";

const schema = z.object({ name: z.string().min(1, "Nom requis").max(60) });

/** GET /api/dev/api-keys — liste les clés (sans le secret). */
export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();
  const keys = await prisma.apiKey.findMany({
    where: { organizationId: session.org.id, revokedAt: null },
    orderBy: { createdAt: "desc" },
  });
  return ok({
    apiKeys: keys.map((k) => ({
      id: k.id,
      name: k.name,
      prefix: k.prefix,
      lastFour: k.lastFour,
      lastUsedAt: k.lastUsedAt,
      createdAt: k.createdAt,
    })),
  });
}

/** POST /api/dev/api-keys — crée une clé ; le secret n'est renvoyé qu'ici. */
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();
    const body = await req.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest("Nom requis");

    const key = generateApiKey();
    const row = await prisma.apiKey.create({
      data: {
        organizationId: session.org.id,
        name: parsed.data.name.trim(),
        prefix: key.prefix,
        lastFour: key.lastFour,
        hash: key.hash,
      },
    });
    return created({
      apiKey: {
        id: row.id,
        name: row.name,
        prefix: row.prefix,
        lastFour: row.lastFour,
        createdAt: row.createdAt,
      },
      secret: key.full,
    });
  } catch {
    return serverError("Impossible de créer la clé");
  }
}
