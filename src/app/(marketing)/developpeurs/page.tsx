import type { Metadata } from "next";
import { BlurFade } from "@/components/magicui/blur-fade";
import { API_PRICE } from "@/components/marketing/content";
import {
  Bullet,
  CodeShowcase,
  CtaBand,
  PageHero,
  PrimaryCta,
  Section,
  SectionHeading,
} from "@/components/marketing/sections";

export const metadata: Metadata = {
  title: "Développeurs",
  description:
    "API REST et webhooks pour créer des agents vocaux, lire les appels et recevoir les événements en temps réel.",
};

const ENDPOINTS = [
  { method: "GET", path: "/api/v1/agents", body: "Lister les agents de l'organisation" },
  { method: "POST", path: "/api/v1/agents", body: "Créer un agent" },
  { method: "GET", path: "/api/v1/agents/{id}", body: "Lire un agent" },
  { method: "PATCH", path: "/api/v1/agents/{id}", body: "Modifier un agent" },
  { method: "DELETE", path: "/api/v1/agents/{id}", body: "Supprimer un agent" },
  { method: "GET", path: "/api/v1/calls", body: "Lister les appels" },
  { method: "GET", path: "/api/v1/calls/{id}", body: "Lire un appel et sa transcription" },
];

const EVENTS = [
  { id: "call.completed", body: "Un appel est terminé" },
  { id: "call.transferred", body: "Un appel a été transféré à un humain" },
  { id: "agent.created", body: "Un agent a été créé" },
  { id: "agent.updated", body: "Un agent a été modifié" },
  { id: "agent.deleted", body: "Un agent a été supprimé" },
];

const METHOD_COLOR: Record<string, string> = {
  GET: "text-success",
  POST: "text-brand",
  PATCH: "text-warning",
  DELETE: "text-destructive",
};

export default function DeveloppeursPage() {
  return (
    <>
      <PageHero
        eyebrow="Développeurs"
        title="Une API vocale simple et prévisible."
        subtitle={`Créez des agents, lisez les appels et recevez les événements par webhook. ${API_PRICE} la minute, voix, transcription et téléphonie comprises.`}
      >
        <PrimaryCta href="/register">Obtenir une clé d'API</PrimaryCta>
        <PrimaryCta href="/documentation" variant="ghost">Documentation</PrimaryCta>
      </PageHero>

      <Section>
        <div className="grid items-start gap-12 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="lg:sticky lg:top-32">
            <SectionHeading
              align="left"
              eyebrow="Démarrage"
              title="Créez un agent en une requête."
              subtitle="Authentifiez-vous avec votre clé, envoyez un JSON, recevez l'agent créé."
            />
            <ul className="mt-8 space-y-3">
              <Bullet>Authentification par clé (en-tête Authorization: Bearer)</Bullet>
              <Bullet>Clés révocables à tout moment depuis le tableau de bord</Bullet>
              <Bullet>Réponses JSON, codes HTTP standards</Bullet>
            </ul>
          </div>
          <CodeShowcase />
        </div>
      </Section>

      <Section>
        <SectionHeading
          eyebrow="Référence"
          title="Les points d'accès de l'API v1."
          subtitle="Toutes les requêtes sont limitées à l'organisation de la clé utilisée."
        />
        <BlurFade delay={0.1} className="mx-auto mt-14 max-w-3xl">
          <div className="bezel">
            <div className="bezel-core overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-sm">
                <caption className="sr-only">Points d'accès de l'API Callpme v1</caption>
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                    <th scope="col" className="px-5 py-3 font-medium">Méthode</th>
                    <th scope="col" className="px-5 py-3 font-medium">Chemin</th>
                    <th scope="col" className="px-5 py-3 font-medium">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {ENDPOINTS.map((e) => (
                    <tr key={e.method + e.path}>
                      <td className={`mono px-5 py-3.5 text-xs font-semibold ${METHOD_COLOR[e.method]}`}>{e.method}</td>
                      <td className="mono px-5 py-3.5 text-xs text-foreground">{e.path}</td>
                      <td className="px-5 py-3.5 text-muted-foreground">{e.body}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </BlurFade>
      </Section>

      <Section>
        <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
          <SectionHeading
            align="left"
            eyebrow="Webhooks"
            title="Recevez chaque événement en temps réel."
            subtitle="Chaque envoi est signé avec le secret de votre webhook. Vérifiez la signature avant de traiter le contenu."
          />
          <ul className="divide-y divide-border border-y border-border">
            {EVENTS.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-6 py-5">
                <code className="mono text-sm text-foreground">{e.id}</code>
                <span className="text-right text-sm text-muted-foreground">{e.body}</span>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      <CtaBand
        title="Votre première clé d'API en deux minutes."
        subtitle="Créez un compte, générez une clé et lancez votre premier appel avec les crédits d'essai."
        label="Créer un compte"
      />
    </>
  );
}
