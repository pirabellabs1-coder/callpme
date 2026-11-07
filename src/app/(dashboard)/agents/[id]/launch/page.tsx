import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CheckCircle2, Circle, Globe, Phone, PhoneForwarded, ShoppingCart, Sparkles } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { getAgentById } from "@/lib/db/agents";
import { getLaunchState } from "@/lib/onboarding/launch";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { GoLiveButton } from "@/components/agents/go-live-button";
import { cn } from "@/lib/utils";

export const metadata = { title: "Mise en ligne" };
export const dynamic = "force-dynamic";

export default async function AgentLaunchPage({ params }: { params: { id: string } }) {
  const session = await requireSession();
  const agent = await getAgentById(params.id);
  if (!agent || agent.organizationId !== session.org.id) notFound();
  const state = await getLaunchState(agent);
  const base = `/agents/${agent.id}`;
  const blocking = state.steps.filter((s) => s.required && !s.done && s.key !== "online");

  return (
    <div className="space-y-6">
      {state.live ? (
        <Card className="border-emerald-500/30 bg-emerald-500/5 p-6">
          <div className="flex flex-wrap items-start gap-4">
            <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <Sparkles className="size-6" aria-hidden />
            </span>
            <div className="min-w-0 flex-1 space-y-2">
              <h2 className="text-lg font-semibold">{agent.name} est en ligne</h2>
              <p className="text-sm text-muted-foreground">Vos clients peuvent le joindre dès maintenant :</p>
              <ul className="space-y-1.5 text-sm">
                {state.phone?.active && (
                  <li className="flex items-center gap-2">
                    <Phone className="size-4 text-muted-foreground" aria-hidden />
                    Par téléphone au{" "}
                    <a href={`tel:${state.phone.number}`} className="mono font-medium text-foreground hover:underline">
                      {state.phone.number}
                    </a>{" "}
                    (appelez-le pour l&apos;entendre)
                  </li>
                )}
                {state.widgetSites.length > 0 && (
                  <li className="flex items-center gap-2">
                    <Globe className="size-4 text-muted-foreground" aria-hidden />
                    Sur votre site : {state.widgetSites.join(", ")}
                  </li>
                )}
              </ul>
              <div className="flex flex-wrap gap-2 pt-1">
                <Link href="/calls" className={buttonVariants({ variant: "outline", size: "sm" })}>
                  Voir les appels
                </Link>
                <Link href={`${base}/flow`} className={buttonVariants({ variant: "ghost", size: "sm" })}>
                  Améliorer le parcours
                </Link>
              </div>
            </div>
          </div>
        </Card>
      ) : (
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Mettre {agent.name} en ligne</h2>
          <p className="text-sm text-muted-foreground">
            Suivez ces étapes dans l&apos;ordre. Les étapes « indispensables » sont nécessaires pour que l&apos;agent réponde à
            vos clients ; les autres le rendent bien meilleur.
          </p>
          <div className="mt-3 flex items-center gap-3" aria-label={`Progression : ${state.progress} %`}>
            <div className="h-2 w-full max-w-sm overflow-hidden rounded-full bg-secondary">
              <div className="h-full rounded-full bg-brand transition-[width]" style={{ width: `${state.progress}%` }} />
            </div>
            <span className="tabular text-sm text-muted-foreground">{state.progress} %</span>
          </div>
        </div>
      )}

      <ol className="space-y-3">
        {state.steps.map((s, i) => (
          <li key={s.key}>
            <Card className={cn("flex flex-wrap items-start gap-4 p-4", s.done && "opacity-80")}>
              <span className="mt-0.5" aria-hidden>
                {s.done ? <CheckCircle2 className="size-5 text-emerald-500" /> : <Circle className="size-5 text-muted-foreground" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-medium">
                  <span className="sr-only">{s.done ? "Fait : " : "À faire : "}</span>
                  {i + 1}. {s.title}
                  {s.required ? <Badge variant="outline">Indispensable</Badge> : <Badge variant="muted">Recommandé</Badge>}
                </p>
                <p className="mt-0.5 text-sm text-muted-foreground">{s.why}</p>
                {!s.done && s.todo && <p className="mt-1.5 text-sm">{s.todo}</p>}
              </div>
              {s.key === "online" ? (
                !s.done && <GoLiveButton agentId={agent.id} disabled={blocking.length > 0} />
              ) : (
                s.action &&
                !s.done && (
                  <Link href={s.action.href} className={buttonVariants({ variant: "outline", size: "sm" })}>
                    {s.action.label} <ArrowRight className="size-4" aria-hidden />
                  </Link>
                )
              )}
            </Card>
          </li>
        ))}
      </ol>

      {/* Les façons de joindre l'agent, expliquées simplement */}
      <section id="canaux" aria-labelledby="canaux-title" className="scroll-mt-6 space-y-3">
        <h2 id="canaux-title" className="text-base font-semibold">
          Comment vos clients joignent l&apos;agent
        </h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Card className="space-y-2 p-4">
            <Globe className="size-5 text-brand" aria-hidden />
            <p className="font-medium">Bouton sur votre site</p>
            <p className="text-sm text-muted-foreground">Le plus rapide : un bouton « Parler à notre assistant », sans numéro de téléphone.</p>
            <Link href={`${base}/widget`} className={buttonVariants({ variant: "link", size: "sm", className: "px-0" })}>
              Activer le bouton
            </Link>
          </Card>
          <Card className="space-y-2 p-4">
            <ShoppingCart className="size-5 text-brand" aria-hidden />
            <p className="font-medium">Un nouveau numéro</p>
            <p className="text-sm text-muted-foreground">Achetez-le chez votre opérateur (Twilio, Telnyx…), puis ajoutez-le et reliez-le à l&apos;agent.</p>
            <Link href="/numbers" className={buttonVariants({ variant: "link", size: "sm", className: "px-0" })}>
              Ajouter un numéro
            </Link>
          </Card>
          <Card className="space-y-2 p-4">
            <Phone className="size-5 text-brand" aria-hidden />
            <p className="font-medium">Votre numéro actuel</p>
            <p className="text-sm text-muted-foreground">Déclarez le numéro que vous avez déjà : l&apos;équipe Callpme le raccorde puis l&apos;active.</p>
            <Link href="/numbers" className={buttonVariants({ variant: "link", size: "sm", className: "px-0" })}>
              Déclarer un numéro
            </Link>
          </Card>
          <Card className="space-y-2 p-4">
            <PhoneForwarded className="size-5 text-brand" aria-hidden />
            <p className="font-medium">Renvoi d&apos;appel</p>
            <p className="text-sm text-muted-foreground">
              Gardez votre ligne : renvoyez-la vers le numéro de l&apos;agent quand vous êtes occupé ou absent (réglage chez votre
              opérateur).
            </p>
            <Link href="/numbers" className={buttonVariants({ variant: "link", size: "sm", className: "px-0" })}>
              Voir comment faire
            </Link>
          </Card>
        </div>
      </section>
    </div>
  );
}
