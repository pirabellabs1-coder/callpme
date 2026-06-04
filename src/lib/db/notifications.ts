/** Dépôt « Notifications ». */
import { prisma } from "./client";

export interface NotifRecord {
  id: string;
  type: string;
  title: string;
  body: string | null;
  href: string | null;
  read: boolean;
  createdAt: string;
}

export async function listNotifications(
  orgId: string,
  limit = 15,
): Promise<NotifRecord[]> {
  const rows = await prisma.notification.findMany({
    where: { organizationId: orgId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    title: r.title,
    body: r.body,
    href: r.href,
    read: r.read,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function unreadCount(orgId: string): Promise<number> {
  return prisma.notification.count({
    where: { organizationId: orgId, read: false },
  });
}

export async function markAllRead(orgId: string) {
  await prisma.notification.updateMany({
    where: { organizationId: orgId, read: false },
    data: { read: true },
  });
}

export async function createNotification(
  orgId: string,
  data: { type?: string; title: string; body?: string; href?: string },
) {
  return prisma.notification.create({
    data: {
      organizationId: orgId,
      type: data.type ?? "info",
      title: data.title,
      body: data.body || null,
      href: data.href || null,
    },
  });
}
