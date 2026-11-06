import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { requireSession } from "@/lib/auth/session";
import { getAgentById } from "@/lib/db/agents";
import { WIDGET_DEFAULTS } from "@/lib/widget/widget";
import { WidgetSettings } from "@/components/agents/widget-settings";

export const metadata = { title: "Site web" };
export const dynamic = "force-dynamic";

export default async function AgentWidgetPage({ params }: { params: { id: string } }) {
  const session = await requireSession();
  const agent = await getAgentById(params.id);
  if (!agent || agent.organizationId !== session.org.id) notFound();

  // Adresse publique de l'application (celle que les sites appelleront).
  const h = headers();
  const appUrl = process.env.PUBLIC_URL || `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Votre agent sur votre site web</h2>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Ajoutez un bouton « Parler à notre assistant » sur votre site : vos visiteurs parlent à {agent.name} au micro,
          sans téléphone. Les conversations apparaissent dans « Appels » et comptent dans vos minutes.
        </p>
      </div>
      <WidgetSettings
        agentId={agent.id}
        agentActive={agent.status === "active"}
        appUrl={appUrl}
        initial={{ ...WIDGET_DEFAULTS, ...agent.config.widget }}
      />
    </div>
  );
}
