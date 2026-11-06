import Link from "next/link";
import { ArrowRight, Bot, LayoutTemplate, Rocket, Sparkles } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { listAgents } from "@/lib/db/agents";
import { getLaunchState } from "@/lib/onboarding/launch";
import { orgSubscription } from "@/lib/billing/limits";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";

export const metadata = { title: "Bien démarrer" };
export const dynamic = "force-dynamic";

const GUIDE = [
  { title: "Créez un agent", text: "Partez d'un modèle (cabinet, salon, agence immobilière…) : tout est prérempli, vous ajustez." },
  { title: "Donnez-lui vos informations", text: "Horaires, tarifs, adresse, FAQ ou votre site web : il s'en sert pour répondre juste." },
  { title: "Testez-le", text: "Parlez-lui au micro ou par écrit, comme un client, et corrigez." },
  { title: "Choisissez comment on le joint", text: "Un bouton sur votre site, un numéro de téléphone, ou le renvoi de votre ligne." },
  { title: "Mettez-le en ligne", text: "Il répond, prend les rendez-vous et les messages ; vous suivez tout dans « Appels »." },
];

export default async function StartPage() {
  const session = await requireSession();
  const [agents, sub] = await Promise.all([listAgents(session.org.id), orgSubscription(session.org.id)]);
  const states = await Promise.all(agents.slice(0, 12).map(async (a) => ({ agent: a, state: await getLaunchState(a) })));

  return (
    <div className="space-y-8">
      <PageHeader
        title="Bien démarrer"
        description="Le chemin complet, de la création de votre agent à ses premiers appels."
        breadcrumb={[{ label: "Bien démarrer" }]}
      />

      <ol className="grid gap-3 md:grid-cols-5">
        {GUIDE.map((g, i) => (
          <li key={g.title}>
            <Card className="h-full space-y-1.5 p-4">
              <span className="inline-flex size-7 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand">
                {i + 1}
              </span>
              <p className="font-medium">{g.title}</p>
              <p className="text-sm text-muted-foreground">{g.text}</p>
            </Card>
          </li>
        ))}
      </ol>

      {sub.status === "trial" && (
        <p className="rounded-xl border border-border bg-secondary/40 px-4 py-3 text-sm">
          Essai gratuit : {sub.daysLeft} jour{sub.daysLeft > 1 ? "s" : ""} et {sub.minutesIncluded} minutes d&apos;appel pour tout
          essayer.{" "}
          <Link href="/billing" className="font-medium text-brand hover:underline">
            Voir les offres
          </Link>
        </p>
      )}

      {states.length === 0 ? (
        <Card className="flex flex-col items-center gap-4 p-10 text-center">
          <Bot className="size-10 text-brand" aria-hidden />
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Créez votre premier agent</h2>
            <p className="max-w-md text-sm text-muted-foreground">
              Le plus simple : partez d&apos;un modèle adapté à votre métier, puis laissez-vous guider jusqu&apos;à la mise en ligne.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <Link href="/templates" className={buttonVariants({ variant: "brand" })}>
              <LayoutTemplate aria-hidden /> Choisir un modèle
            </Link>
            <Link href="/agents/new" className={buttonVariants({ variant: "outline" })}>
              Créer de zéro
            </Link>
          </div>
        </Card>
      ) : (
        <section aria-labelledby="agents-launch" className="space-y-3">
          <h2 id="agents-launch" className="text-base font-semibold">
            Vos agents
          </h2>
          <ul className="grid gap-3 md:grid-cols-2">
            {states.map(({ agent, state }) => {
              const next = state.steps.find((s) => !s.done);
              return (
                <li key={agent.id}>
                  <Card className="flex h-full flex-col gap-3 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-medium">{agent.name}</p>
                      {state.live ? <Badge variant="success">En ligne</Badge> : <Badge variant="muted">{state.progress} %</Badge>}
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-secondary" aria-hidden>
                      <div className="h-full rounded-full bg-brand" style={{ width: `${state.progress}%` }} />
                    </div>
                    <p className="flex-1 text-sm text-muted-foreground">
                      {state.live ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Sparkles className="size-4 text-emerald-500" aria-hidden /> Il répond à vos clients.
                        </span>
                      ) : next ? (
                        <>Prochaine étape : {next.title.toLowerCase()}.</>
                      ) : (
                        "Tout est prêt."
                      )}
                    </p>
                    <Link href={`/agents/${agent.id}/launch`} className={buttonVariants({ variant: state.live ? "outline" : "brand", size: "sm" })}>
                      <Rocket aria-hidden /> {state.live ? "Voir la mise en ligne" : "Continuer"} <ArrowRight aria-hidden />
                    </Link>
                  </Card>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
