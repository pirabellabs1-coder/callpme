import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import {
  ArrowLeft,
  Pencil,
  Phone,
  PhoneOff,
  PhoneCall,
  CircleCheck,
  Timer,
  Wrench,
  ShieldCheck,
  MessageSquareText,
  ArrowRight,
  Megaphone,
  Ear,
  Clock,
  FunctionSquare,
} from "lucide-react";
import { getAgentById } from "@/lib/db/agents";
import { listCalls } from "@/lib/db/calls";
import { listCustomTools } from "@/lib/db/custom-tools";
import { ROLE_META } from "@/lib/agents/roles";
import { resolveTools } from "@/lib/tools/registry";
import { languageLabel, VOICE_PROVIDERS, MODEL_PROVIDERS } from "@/lib/agents/catalog";
import { cn, formatDuration, formatNumber } from "@/lib/utils";
import { RoleIcon, RoleBadge } from "@/components/role-badge";
import { CallStatusBadge } from "@/components/status-badges";
import { DynamicIcon } from "@/components/icon";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat";
import { buttonVariants } from "@/components/ui/button";
import {
  AgentStatusControl,
  DeleteAgentButton,
} from "@/components/agents/agent-actions";

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}) {
  const agent = await getAgentById(params.id);
  return { title: agent?.name ?? "Agent" };
}

function KeyValue({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground">{children}</span>
    </div>
  );
}

export default async function AgentDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const agent = await getAgentById(params.id);
  if (!agent) notFound();

  const calls = await listCalls(agent.organizationId, {
    agentId: agent.id,
    limit: 6,
  });
  const customTools = await listCustomTools(agent.organizationId);
  const customByName = new Map(customTools.map((t) => [t.name, t]));
  const displayTools = [
    ...resolveTools(agent.config.tools).map((t) => ({
      name: t.name,
      label: t.label,
      icon: t.icon,
      custom: false,
    })),
    ...agent.config.tools
      .filter((n) => customByName.has(n))
      .map((n) => ({
        name: n,
        label: customByName.get(n)!.label,
        icon: "FunctionSquare",
        custom: true,
      })),
  ];
  const roleLabel =
    agent.role === "custom"
      ? agent.config.customRole?.label || "Rôle personnalisé"
      : ROLE_META[agent.role].label;
  const voiceProvider =
    VOICE_PROVIDERS.find((p) => p.id === agent.config.voice.provider)?.label ??
    agent.config.voice.provider;
  const modelProvider =
    MODEL_PROVIDERS.find((p) => p.id === agent.config.model.provider)?.label ??
    agent.config.model.provider;

  return (
    <div className="space-y-6">
      <Link
        href="/agents"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Agents
      </Link>

      {/* En-tête */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <RoleIcon role={agent.role} size="xl" />
          <div>
            <h1 className="text-display-sm font-semibold tracking-tight">
              {agent.name}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <RoleBadge
                role={agent.role}
                label={agent.role === "custom" ? roleLabel : undefined}
                withIcon
              />
              {agent.phoneNumber ? (
                <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Phone className="size-3.5" strokeWidth={1.75} />
                  <span className="mono">{agent.phoneNumber}</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                  <PhoneOff className="size-3.5" strokeWidth={1.75} />
                  Aucun numéro
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AgentStatusControl agentId={agent.id} status={agent.status} />
          <Link
            href={`/agents/${agent.id}/test`}
            className={cn(buttonVariants({ variant: "brand" }), "gap-1.5")}
          >
            <Phone className="size-4" />
            Tester
          </Link>
          <Link
            href={`/agents/${agent.id}/edit`}
            className={cn(buttonVariants({ variant: "outline" }), "gap-1.5")}
          >
            <Pencil className="size-4" />
            Éditer
          </Link>
          <DeleteAgentButton agentId={agent.id} agentName={agent.name} />
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Appels (total)"
          value={formatNumber(agent.callsTotal ?? 0)}
          icon={PhoneCall}
        />
        <StatCard
          label="Aujourd'hui"
          value={formatNumber(agent.callsToday ?? 0)}
          icon={PhoneCall}
        />
        <StatCard
          label="Résolution"
          value={`${agent.resolutionRate ?? 0}%`}
          icon={CircleCheck}
        />
        <StatCard
          label="Durée moyenne"
          value={formatDuration(agent.avgDurationSec ?? 0)}
          icon={Timer}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Colonne principale */}
        <div className="space-y-5 lg:col-span-2">
          {/* Comportement */}
          <Card className="p-5">
            <h2 className="flex items-center gap-2 text-[0.95rem] font-semibold tracking-tight">
              <MessageSquareText className="size-4 text-muted-foreground" />
              Comportement
            </h2>
            <p className="mt-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Premier message
            </p>
            <div className="mt-2 rounded-xl rounded-tl-sm border border-border bg-secondary/40 px-4 py-3">
              <p className="text-sm leading-relaxed text-foreground text-pretty">
                {agent.config.firstMessage}
              </p>
            </div>
            {agent.config.persona && (
              <>
                <p className="mt-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Personnalité
                </p>
                <p className="mt-1.5 text-sm text-foreground">
                  {agent.config.persona}
                </p>
              </>
            )}
          </Card>

          {/* System prompt */}
          <Card className="p-5">
            <h2 className="text-[0.95rem] font-semibold tracking-tight">
              System prompt
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Généré depuis le rôle « {roleLabel} ».
            </p>
            <pre className="mt-4 max-h-96 overflow-auto whitespace-pre-wrap rounded-lg border border-border bg-secondary/30 p-4 font-mono text-[0.78rem] leading-relaxed text-foreground/90">
              {agent.config.systemPrompt}
            </pre>
          </Card>

          {/* Appels récents */}
          <Card>
            <div className="flex items-center justify-between p-5 pb-3">
              <h2 className="text-[0.95rem] font-semibold tracking-tight">
                Appels récents
              </h2>
              <Link
                href={`/calls?agentId=${agent.id}`}
                className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:text-brand-700"
              >
                Tous
                <ArrowRight className="size-3.5" />
              </Link>
            </div>
            {calls.length === 0 ? (
              <p className="px-5 pb-5 text-sm text-muted-foreground">
                Aucun appel pour cet agent pour l'instant.
              </p>
            ) : (
              <div className="divide-y divide-border">
                {calls.map((call) => (
                  <Link
                    key={call.id}
                    href={`/calls/${call.id}`}
                    className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-accent/40"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {call.outcome ?? "Appel"}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {call.fromNumber} ·{" "}
                        {formatDistanceToNow(new Date(call.createdAt), {
                          addSuffix: true,
                          locale: fr,
                        })}
                      </p>
                    </div>
                    <span className="hidden text-xs tabular text-muted-foreground sm:block">
                      {formatDuration(call.durationSec)}
                    </span>
                    <CallStatusBadge status={call.status} />
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Colonne latérale */}
        <div className="space-y-5">
          <Card className="p-5">
            <h2 className="text-[0.95rem] font-semibold tracking-tight">
              Configuration
            </h2>
            <div className="mt-2 divide-y divide-border">
              <KeyValue label="Voix">
                {agent.config.voice.voiceId}{" "}
                <span className="text-muted-foreground">· {voiceProvider}</span>
              </KeyValue>
              <KeyValue label="Langue">
                {languageLabel(agent.config.voice.language)}
              </KeyValue>
              <KeyValue label="Débit">
                <span className="mono">{agent.config.voice.speed.toFixed(2)}×</span>
              </KeyValue>
              <KeyValue label="Modèle">
                {agent.config.model.modelId}{" "}
                <span className="text-muted-foreground">· {modelProvider}</span>
              </KeyValue>
              <KeyValue label="Température">
                <span className="mono">
                  {agent.config.model.temperature.toFixed(1)}
                </span>
              </KeyValue>
              <KeyValue label="Ouverture">
                {(agent.config.firstSpeaker ?? "agent") === "caller" ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Ear className="size-3.5 text-muted-foreground" />
                    L'appelant
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5">
                    <Megaphone className="size-3.5 text-muted-foreground" />
                    L'agent
                  </span>
                )}
              </KeyValue>
              {agent.config.maxDurationSec ? (
                <KeyValue label="Durée max">
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="size-3.5 text-muted-foreground" />
                    {Math.round(agent.config.maxDurationSec / 60)} min
                  </span>
                </KeyValue>
              ) : null}
              <KeyValue label="Numéro">
                {agent.phoneNumber ? (
                  <span className="mono">{agent.phoneNumber}</span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </KeyValue>
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="flex items-center gap-2 text-[0.95rem] font-semibold tracking-tight">
              <Wrench className="size-4 text-muted-foreground" />
              Outils & fonctions
              <span className="ml-auto text-sm font-normal text-muted-foreground">
                {displayTools.length}
              </span>
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {displayTools.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun outil activé.</p>
              ) : (
                displayTools.map((tool) => (
                  <span
                    key={tool.name}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium",
                      tool.custom
                        ? "border-brand/30 bg-brand-50/40 text-brand-700"
                        : "border-border bg-secondary/50 text-foreground/80",
                    )}
                  >
                    <DynamicIcon name={tool.icon} className="size-3.5" />
                    {tool.label}
                  </span>
                ))
              )}
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="flex items-center gap-2 text-[0.95rem] font-semibold tracking-tight">
              <ShieldCheck className="size-4 text-muted-foreground" />
              Garde-fous
            </h2>
            <div className="mt-3 space-y-2">
              {agent.config.guardrails.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Aucun garde-fou spécifique.
                </p>
              ) : (
                agent.config.guardrails.map((g, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand" />
                    <span className="text-foreground/90">{g}</span>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
