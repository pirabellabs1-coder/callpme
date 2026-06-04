import { getSession } from "@/lib/auth/session";
import { listNotifications, unreadCount } from "@/lib/db/notifications";
import { ok, unauthorized, serverError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return unauthorized();
    const [notifications, unread] = await Promise.all([
      listNotifications(session.org.id),
      unreadCount(session.org.id),
    ]);
    return ok({ notifications, unread });
  } catch {
    return serverError();
  }
}
