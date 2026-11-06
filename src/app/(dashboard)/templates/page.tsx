import { AGENT_TEMPLATES, TEMPLATE_CATEGORIES } from "@/lib/agents/templates";
import { PageHeader } from "@/components/dashboard/page-header";
import { TemplatesGallery } from "./templates-gallery";

export const metadata = { title: "Modèles d'agents" };

export default function TemplatesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Modèles d'agents"
        description={`${AGENT_TEMPLATES.length} modèles métier pré-configurés : choisissez votre secteur, l'assistant de création se remplit pour vous.`}
      />
      <TemplatesGallery templates={AGENT_TEMPLATES} categories={TEMPLATE_CATEGORIES} />
    </div>
  );
}
