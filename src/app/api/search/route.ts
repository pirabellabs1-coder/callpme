import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { ok, unauthorized, serverError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();
    const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
    if (q.length < 1) {
      return ok({ agents: [], clients: [], calls: [] });
    }
    const orgId = session.org.id;
    const [agents, clients, calls] = await Promise.all([
      prisma.agent.findMany({
        where: { organizationId: orgId, name: { contains: q } },
        take: 5,
        select: { id: true, name: true, role: true },
      }),
      prisma.client.findMany({
        where: { organizationId: orgId, name: { contains: q } },
        take: 5,
        select: { id: true, name: true },
      }),
      prisma.call.findMany({
        where: {
          agent: { organizationId: orgId },
          OR: [
            { summary: { contains: q } },
            { outcome: { contains: q } },
            { fromNumber: { contains: q } },
          ],
        },
        take: 5,
        orderBy: { createdAt: "desc" },
        select: { id: true, outcome: true, fromNumber: true },
      }),
    ]);
    return ok({ agents, clients, calls });
  } catch {
    return serverError();
  }
}
