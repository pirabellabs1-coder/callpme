import { getSession } from "@/lib/auth/session";
import { markAllRead } from "@/lib/db/notifications";
import { ok, unauthorized, serverError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const session = await getSession();
    if (!session) return unauthorized();
    await markAllRead(session.org.id);
    return ok({ success: true });
  } catch {
    return serverError();
  }
}
