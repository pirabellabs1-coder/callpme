import type { Metadata } from "next";
import { BlurFade } from "@/components/magicui/blur-fade";
import { CodeBlock, CodeTabs } from "@/components/dev/code-block";
import { DocsPanel } from "@/components/dev/docs-panel";
import { API_PRICE, CODE_SAMPLES } from "@/components/marketing/content";
import {
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

const EVENTS = [
  { id: "call.completed", body: "Un appel est terminé" },
  { id: "call.transferred", body: "Un appel a été transféré à un humain" },
  { id: "agent.created", body: "Un agent a été créé" },
  { id: "agent.updated", body: "Un agent a été modifié" },
  { id: "agent.deleted", body: "Un agent a été supprimé" },
];

const LIST_CALLS = [
  {
    label: "cURL",
    language: "bash",
    code: `curl "https://callpme.com/api/v1/calls" \\
  -H "Authorization: Bearer $CALLPME_KEY"`,
  },
  {
    label: "JavaScript",
    language: "typescript",
    code: `const res = await fetch("https://callpme.com/api/v1/calls", {
  headers: { Authorization: \`Bearer \${process.env.CALLPME_KEY}\` },
});
const { data: calls } = await res.json();`,
  },
];

const VERIFY_WEBHOOK = `import { createHmac, timingSafeEqual } from "node:crypto";

// rawBody : le corps brut de la requête, avant tout JSON.parse
export function verifyCallpmeSignature(rawBody: string, header: string, secret: string) {
  const expected = "sha256=" + createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(header ?? "");
  return a.length === b.length && timingSafeEqual(a, b);
}`;

const QUICKSTART = [
  {
    n: "01",
    title: "Créez une clé d'API",
    body: "Dans le tableau de bord, ouvrez l'espace Développeurs et générez une clé. Conservez-la côté serveur, jamais dans le navigateur.",
  },
  {
    n: "02",
    title: "Créez votre premier agent",
    body: "Un seul appel POST suffit. Le rôle détermine les consignes et les actions par défaut.",
    code: "create",
  },
  {
    n: "03",
    title: "Lisez les appels",
    body: "Récupérez la liste des appels, puis le détail et la transcription de chacun.",
    code: "list",
  },
] as const;

export default function DeveloppeursPage() {
  return (
    <>
      <PageHero
        eyebrow="Développeurs"
        title="Une API vocale simple et prévisible."
        subtitle={`Créez des agents, lisez les appels et recevez les événements par webhook. ${API_PRICE} la minute, voix, transcription et téléphonie comprises.`}
      >
        <PrimaryCta href="/register">Obtenir une clé d'API</PrimaryCta>
        <PrimaryCta href="#reference" variant="ghost">Documentation</PrimaryCta>
      </PageHero>

      <Section>
        <SectionHeading
          eyebrow="Démarrage rapide"
          title="Votre premier agent en trois étapes."
          subtitle="Toutes les requêtes utilisent l'en-tête Authorization: Bearer avec votre clé."
        />
        <ol className="mx-auto mt-16 max-w-4xl space-y-12">
          {QUICKSTART.map((s, i) => (
            <BlurFade key={s.n} as="li" delay={i * 0.06} className="grid gap-6 md:grid-cols-[180px_1fr]">
              <div>
                <span className="mono text-sm text-brand">{s.n}</span>
                <h3 className="mt-2 text-lg font-semibold tracking-tight text-foreground">{s.title}</h3>
              </div>
              <div className="min-w-0 space-y-4">
                <p className="text-sm leading-relaxed text-muted-foreground">{s.body}</p>
                {"code" in s && (
                  <div className="bezel">
                    <div className="bezel-core p-4">
                      <CodeTabs samples={s.code === "create" ? CODE_SAMPLES : LIST_CALLS} />
                    </div>
                  </div>
                )}
              </div>
            </BlurFade>
          ))}
        </ol>
      </Section>

      <Section id="reference">
        <SectionHeading
          eyebrow="Référence"
          title="Documentation complète de l'API v1."
          subtitle="Chaque point d'accès avec ses paramètres et un exemple de réponse. Toutes les requêtes sont limitées à l'organisation de la clé utilisée."
        />
        <div className="mx-auto mt-14 max-w-4xl">
          <DocsPanel apiBaseUrl="https://www.callpme.com" />
        </div>
      </Section>

      <Section>
        <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
          <SectionHeading
            align="left"
            eyebrow="Webhooks"
            title="Recevez chaque événement en temps réel."
            subtitle="Chaque envoi est signé avec le secret de votre webhook. Vérifiez la signature avant de traiter le contenu."
          />
          <div className="min-w-0 space-y-8">
          <ul className="divide-y divide-border border-y border-border">
            {EVENTS.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-6 py-5">
                <code className="mono text-sm text-foreground">{e.id}</code>
                <span className="text-right text-sm text-muted-foreground">{e.body}</span>
              </li>
            ))}
          </ul>
          <div>
            <p className="mb-3 text-sm text-muted-foreground">
              Vérifiez l'en-tête <code className="mono text-foreground">X-Callpme-Signature</code> avant de traiter un événement :
            </p>
            <CodeBlock code={VERIFY_WEBHOOK} language="typescript" />
          </div>
          </div>
        </div>
      </Section>

      <CtaBand
        title="Votre première clé d'API en deux minutes."
        subtitle="Créez un compte, choisissez une offre, générez une clé et lancez votre premier appel."
        label="Créer un compte"
      />
    </>
  );
}
