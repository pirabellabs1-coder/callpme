import type { Metadata } from "next";
import { DocsPanel } from "@/components/dev/docs-panel";
import { PageHero, PrimaryCta } from "@/components/marketing/sections";

export const metadata: Metadata = {
  title: "Documentation de l'API",
  description: "Référence de l'API REST Callpme : agents, appels, transcriptions et webhooks signés.",
};

export default function DocumentationPage() {
  return (
    <>
      <PageHero
        eyebrow="Documentation"
        title="Documentation de l'API"
        subtitle="Créez des agents, lisez les appels et leurs transcriptions, recevez des webhooks signés. Authentifiez-vous avec une clé générée dans votre espace."
      >
        <PrimaryCta href="/register">Obtenir une clé d'API</PrimaryCta>
        <PrimaryCta href="/developpeurs" variant="ghost">Vue d'ensemble</PrimaryCta>
      </PageHero>

      <section className="pb-24 sm:pb-32">
        <div className="container-marketing mx-auto max-w-4xl">
          <DocsPanel apiBaseUrl="https://www.callpme.com" />
        </div>
      </section>
    </>
  );
}
