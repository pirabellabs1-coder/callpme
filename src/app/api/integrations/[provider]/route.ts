import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { disconnectIntegration } from "@/lib/db/integrations";
import { ok, unauthorized, serverError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { provider: string } },
) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();
    await disconnectIntegration(session.org.id, params.provider);
    return ok({ success: true });
  } catch {
    return serverError();
  }
}
