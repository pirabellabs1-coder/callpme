import { headers } from "next/headers";
import Link from "next/link";
import { Globe, MessageCircle, Phone } from "lucide-react";
import { requireSession, isOrgAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card } from "@/components/ui/card";
import { WhatsAppSettings } from "@/components/channels/whatsapp-settings";

export const metadata = { title: "Canaux" };
export const dynamic = "force-dynamic";

export default async function ChannelsPage() {
  const session = await requireSession();
  const [channel, agents] = await Promise.all([
    prisma.whatsAppChannel.findUnique({ where: { organizationId: session.org.id } }),
    prisma.agent.findMany({ where: { organizationId: session.org.id }, select: { id: true, name: true, status: true }, orderBy: { createdAt: "asc" } }),
  ]);
  const h = headers();
  const appUrl = process.env.PUBLIC_URL || `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Canaux"
        description="Partout où vos clients peuvent joindre vos agents : téléphone, site web et WhatsApp."
        breadcrumb={[{ label: "Canaux" }]}
      />
      <div className="grid gap-3 md:grid-cols-2">
        <Card className="flex items-start gap-3 p-4">
          <Phone className="mt-0.5 size-5 text-brand" aria-hidden />
          <div>
            <p className="font-medium">Téléphone</p>
            <p className="text-sm text-muted-foreground">Numéros achetés, déclarés ou renvoi d&apos;appel.</p>
            <Link href="/numbers" className="text-sm font-medium text-brand hover:underline">
              Gérer les numéros
            </Link>
          </div>
        </Card>
        <Card className="flex items-start gap-3 p-4">
          <Globe className="mt-0.5 size-5 text-brand" aria-hidden />
          <div>
            <p className="font-medium">Site web</p>
            <p className="text-sm text-muted-foreground">
              Bouton « Parler à notre assistant » sur votre site : choisissez l&apos;agent qui répondra.
            </p>
            {agents.length === 0 ? (
              <Link href="/agents/new" className="text-sm font-medium text-brand hover:underline">
                Créer un agent
              </Link>
            ) : (
              <ul className="mt-1 space-y-1">
                {agents.map((a) => (
                  <li key={a.id}>
                    <Link href={`/agents/${a.id}/widget`} className="text-sm font-medium text-brand hover:underline">
                      Régler le bouton de « {a.name} » →
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </div>

      <Card className="space-y-4 p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <MessageCircle className="size-5 text-emerald-500" aria-hidden />
          <h2 className="text-base font-semibold">WhatsApp Business</h2>
        </div>
        <p className="max-w-3xl text-sm text-muted-foreground">
          Vos clients écrivent ou envoient une note vocale à votre numéro WhatsApp Business : l&apos;agent répond aussitôt, prend les
          rendez-vous et les messages. Les échanges apparaissent dans « Conversations ».
        </p>
        <WhatsAppSettings
          canEdit={isOrgAdmin(session)}
          agents={agents}
          channel={
            channel
              ? {
                  agentId: channel.agentId,
                  phoneNumberId: channel.phoneNumberId,
                  displayNumber: channel.displayNumber,
                  enabled: channel.enabled,
                  // Réservé aux administrateurs (pas envoyé aux simples membres).
                  webhookUrl: isOrgAdmin(session) ? `${appUrl.replace(/\/$/, "")}/api/whatsapp/webhook/${channel.id}` : "",
                  verifyToken: isOrgAdmin(session) ? channel.verifyToken : "",
                }
              : null
          }
        />
      </Card>
    </div>
  );
}
