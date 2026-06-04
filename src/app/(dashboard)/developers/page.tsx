import { headers } from "next/headers";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { listCustomToolsFull } from "@/lib/db/custom-tools";
import { PageHeader } from "@/components/dashboard/page-header";
import { DeveloperTabs } from "@/components/dev/developer-tabs";

export const metadata = { title: "Développeurs" };
export const dynamic = "force-dynamic";

export default async function DevelopersPage() {
  const session = await requireSession();

  const [keys, hooks, functions] = await Promise.all([
    prisma.apiKey.findMany({
      where: { organizationId: session.org.id, revokedAt: null },
      orderBy: { createdAt: "desc" },
    }),
    prisma.webhook.findMany({
      where: { organizationId: session.org.id },
      orderBy: { createdAt: "desc" },
    }),
    listCustomToolsFull(session.org.id),
  ]);

  const h = headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const apiBaseUrl = `${proto}://${host}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Développeurs"
        description="Clés API, webhooks et documentation pour automatiser Callpme."
      />
      <DeveloperTabs
        apiBaseUrl={apiBaseUrl}
        apiKeys={keys.map((k) => ({
          id: k.id,
          name: k.name,
          prefix: k.prefix,
          lastFour: k.lastFour,
          lastUsedAt: k.lastUsedAt ? k.lastUsedAt.toISOString() : null,
          createdAt: k.createdAt.toISOString(),
        }))}
        webhooks={hooks.map((w) => ({
          id: w.id,
          url: w.url,
          events: ((): string[] => {
            try {
              return JSON.parse(w.events);
            } catch {
              return [];
            }
          })(),
          secret: w.secret,
          enabled: w.enabled,
          lastStatus: w.lastStatus,
          lastDeliveryAt: w.lastDeliveryAt ? w.lastDeliveryAt.toISOString() : null,
          createdAt: w.createdAt.toISOString(),
        }))}
        functions={functions}
      />
    </div>
  );
}
