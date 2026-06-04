import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AGENT_TEMPLATES } from "@/lib/agents/templates";
import { ROLE_META } from "@/lib/agents/roles";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DynamicIcon } from "@/components/icon";
import { cn } from "@/lib/utils";

export const metadata = { title: "Modèles d'agents" };

export default function TemplatesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Modèles d'agents"
        description="Démarrez en un clic à partir d'un agent pré-configuré par secteur."
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {AGENT_TEMPLATES.map((t) => (
          <Card key={t.id} className="flex flex-col p-5">
            <div className="flex items-start justify-between">
              <span
                className={cn(
                  "inline-flex size-11 items-center justify-center rounded-xl [&_svg]:size-5",
                  ROLE_META[t.role].iconWrapClass,
                )}
              >
                <DynamicIcon name={t.icon} />
              </span>
              <Badge variant="muted">{t.industry}</Badge>
            </div>
            <h3 className="mt-3 font-semibold tracking-tight text-foreground">{t.name}</h3>
            <p className="mt-1 flex-1 text-sm text-muted-foreground text-pretty">
              {t.description}
            </p>
            <Link
              href={`/agents/new?template=${t.id}`}
              className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:text-brand-700"
            >
              Utiliser ce modèle
              <ArrowRight className="size-3.5" />
            </Link>
          </Card>
        ))}
      </div>
    </div>
  );
}
