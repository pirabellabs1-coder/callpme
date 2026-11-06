import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import {
  ArrowLeft,
  Settings2,
  Phone,
  PhoneOff,
  PhoneCall,
  PlayCircle,
  CircleCheck,
  Timer,
  Wrench,
  ShieldCheck,
  SlidersHorizontal,
  ArrowRight,
  Megaphone,
  Ear,
  BookOpen,
  FileCode2,
  ChevronDown,
  Inbox,
} from "lucide-react";
import { getCurrentOrg } from "@/lib/db/context";
import { getAgentById } from "@/lib/db/agents";
import { listCalls } from "@/lib/db/calls";
import { listCustomTools } from "@/lib/db/custom-tools";
import { listKnowledgeBases } from "@/lib/db/knowledge";
import { getVoice } from "@/lib/db/voices";
import { getPresetVoice } from "@/lib/voices/catalog";
import { ROLE_META } from "@/lib/agents/roles";
import { resolveTools } from "@/lib/tools/registry";
import { languageLabel, MODELS, MODEL_PROVIDERS } from "@/lib/agents/catalog";
import { cn, formatDuration, formatNumber } from "@/lib/utils";
import { RoleIcon, RoleBadge } from "@/components/role-badge";
import {
  AgentStatusBadge,
  CallStatusBadge,
  DirectionBadge,
} from "@/components/status-badges";
import { DynamicIcon } from "@/components/icon";
import { SeedNotice } from "@/components/dashboard/seed-notice";
import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat";
import { buttonVariants } from "@/components/ui/button";
import {
  AgentStatusControl,
  DeleteAgentButton,
} from "@/components/agents/agent-actions";

export async function generateMetadata({ params }: { params: { id: string } }) {
  const org = await getCurrentOrg();
  const agent = await getAgentById(params.id);
  return {
    title:
      agent && org && agent.organizationId === org.id ? agent.name : "Agent",
  };
}

function KeyValue({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <dt className="shrink-0 text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right text-sm font-medium text-foreground">
        {children}
      </dd>
    </div>
  );
}

function SectionTitle({
  icon: Icon,
  children,
  aside,
}: {
  icon: typeof Wrench;
  children: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="size-4 text-muted-foreground" aria-hidden />
      <h2 className="text-[0.95rem] font-semibold tracking-tight">
        {children}
      </h2>
      {aside && <div className="ml-auto">{aside}</div>}
    </div>
  );
}

export default async function AgentDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const org = await getCurrentOrg();
  if (!org) return <SeedNotice />;
  const agent = await getAgentById(params.id);
  // Un agent d'une autre organisation est traité comme inexistant.
  if (!agent || agent.organizationId !== org.id) notFound();

  const [calls, customTools, kbs, studioVoice] = await Promise.all([
    listCalls(org.id, { agentId: agent.id, limit: 6 }),
    listCustomTools(org.id),
    agent.knowledgeBaseId ? listKnowledgeBases(org.id) : Promise.resolve([]),
    agent.config.voice.voiceId
      ? getVoice(org.id, agent.config.voice.voiceId)
      : Promise.resolve(null),
  ]);

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
  const voiceName =
    studioVoice?.name ??
    agent.config.voice.voiceLabel ??
    getPresetVoice(agent.config.voice.voiceId)?.label ??
    (agent.config.voice.voiceId || "—");
  const modelLabel =
    MODELS[agent.config.model.provider]?.find(
      (m) => m.id === agent.config.model.modelId,
    )?.label ?? agent.config.model.modelId;
  const modelProvider =
    MODEL_PROVIDERS.find((p) => p.id === agent.config.model.provider)?.label ??
    agent.config.model.provider;
  const kbName = kbs.find((k) => k.id === agent.knowledgeBaseId)?.name;
  const callerFirst = (agent.config.firstSpeaker ?? "agent") === "caller";

  return (
    <div className="space-y-6">
      {!agent.phoneNumber && agent.status === "active" && (
        <p className="flex items-start gap-2 rounded-lg border border-amber-600/25 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          <PhoneOff className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            Cet agent est en ligne mais n&apos;a pas de numéro : il ne peut pas
            encore recevoir d&apos;appels.{" "}
            <Link
              href={`/agents/${agent.id}/edit`}
              className="font-medium underline underline-offset-2"
            >
              Assigner un numéro
            </Link>
          </span>
        </p>
      )}

      {/* KPI */}
      <section
        aria-label="Indicateurs"
        className="grid grid-cols-2 gap-4 lg:grid-cols-4"
      >
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
          label="Taux de résolution"
          value={`${agent.resolutionRate ?? 0}%`}
          hint="Appels terminés avec succès"
          icon={CircleCheck}
        />
        <StatCard
          label="Durée moyenne"
          value={formatDuration(agent.avgDurationSec ?? 0)}
          icon={Timer}
        />
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Colonne principale */}
        <div className="space-y-5 lg:col-span-2">
          {/* Configuration */}
          <Card className="p-5">
            <SectionTitle
              icon={SlidersHorizontal}
              aside={
                <Link
                  href={`/agents/${agent.id}/edit`}
                  className="rounded-sm text-sm font-medium text-brand-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/55"
                >
                  Modifier
                </Link>
              }
            >
              Configuration
            </SectionTitle>

            <div className="mt-4">
              <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {callerFirst ? (
                  <>
                    <Ear className="size-3.5" aria-hidden />
                    L&apos;appelant parle en premier
                  </>
                ) : (
                  <>
                    <Megaphone className="size-3.5" aria-hidden />
                    Message d&apos;accueil
                  </>
                )}
              </p>
              <div className="mt-2 rounded-xl rounded-tl-sm border border-border bg-secondary/40 px-4 py-3">
                <p className="text-sm leading-relaxed text-foreground text-pretty">
                  {callerFirst
                    ? "L'agent reste silencieux au décroché, écoute la demande, puis répond."
                    : agent.config.firstMessage ||
                      ROLE_META[agent.role].firstMessage}
                </p>
              </div>
            </div>

            <dl className="mt-4 grid grid-cols-1 gap-x-8 divide-y divide-border sm:grid-cols-2 sm:divide-y-0">
              <div className="divide-y divide-border">
                <KeyValue label="Voix">{voiceName}</KeyValue>
                <KeyValue label="Langue">
                  {languageLabel(agent.config.voice.language)}
                </KeyValue>
                <KeyValue label="Débit">
                  <span className="mono">
                    {agent.config.voice.speed.toFixed(2)}×
                  </span>
                </KeyValue>
                <KeyValue label="Durée max">
                  {agent.config.maxDurationSec
                    ? `${Math.round(agent.config.maxDurationSec / 60)} min`
                    : "Illimitée"}
                </KeyValue>
              </div>
              <div className="divide-y divide-border">
                <KeyValue label="Modèle">
                  {modelLabel}{" "}
                  <span className="text-muted-foreground">
                    · {modelProvider}
                  </span>
                </KeyValue>
                <KeyValue label="Température">
                  <span className="mono">
                    {agent.config.model.temperature.toFixed(1)}
                  </span>
                </KeyValue>
                <KeyValue label="Personnalité">
                  {agent.config.persona || (
                    <span className="text-muted-foreground">—</span>
                  )}
                </KeyValue>
                <KeyValue label="Connaissances">
                  {kbName ? (
                    <span className="inline-flex items-center gap-1.5">
                      <BookOpen
                        className="size-3.5 text-muted-foreground"
                        aria-hidden
                      />
                      {kbName}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Aucune base</span>
                  )}
                </KeyValue>
              </div>
            </dl>

            {/* Prompt système : replié par défaut (détail technique) */}
            <details className="group mt-4 rounded-lg border border-border">
              <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg px-4 py-3 text-sm font-medium text-foreground transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/55 [&::-webkit-details-marker]:hidden">
                <FileCode2
                  className="size-4 text-muted-foreground"
                  aria-hidden
                />
                Instructions complètes (prompt système)
                <ChevronDown
                  className="ml-auto size-4 text-muted-foreground transition-transform group-open:rotate-180 motion-reduce:transition-none"
                  aria-hidden
                />
              </summary>
              <div className="border-t border-border p-4">
                <p className="mb-3 text-xs text-muted-foreground">
                  Généré depuis le rôle « {roleLabel} ».
                </p>
                <pre className="max-h-96 overflow-auto whitespace-pre-wrap rounded-lg bg-secondary/40 p-4 font-mono text-[0.78rem] leading-relaxed text-foreground/90">
                  {agent.config.systemPrompt || "—"}
                </pre>
              </div>
            </details>
          </Card>

          {/* Appels récents */}
          <Card>
            <div className="flex items-center justify-between p-5 pb-3">
              <SectionTitle icon={PhoneCall}>Appels récents</SectionTitle>
              {calls.length > 0 && (
                <Link
                  href={`/calls?agentId=${agent.id}`}
                  className="inline-flex items-center gap-1 rounded-sm text-sm font-medium text-brand-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/55"
                >
                  Voir tout
                  <ArrowRight className="size-3.5" aria-hidden />
                </Link>
              )}
            </div>
            {calls.length === 0 ? (
              <div className="mx-5 mb-5 flex flex-col items-center rounded-lg border border-dashed border-border px-4 py-8 text-center">
                <Inbox className="size-5 text-muted-foreground" aria-hidden />
                <p className="mt-2 text-sm font-medium text-foreground">
                  Aucun appel pour l&apos;instant
                </p>
                <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                  Lancez un test pour entendre votre agent avant de le mettre en
                  ligne.
                </p>
                <Link
                  href={`/agents/${agent.id}/test`}
                  className={cn(
                    buttonVariants({ variant: "outline", size: "sm" }),
                    "mt-4 gap-1.5",
                  )}
                >
                  <PlayCircle className="size-4" aria-hidden />
                  Tester l&apos;agent
                </Link>
              </div>
            ) : (
              <ul className="divide-y divide-border border-t border-border">
                {calls.map((call) => (
                  <li key={call.id}>
                    <Link
                      href={`/calls/${call.id}`}
                      className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-foreground/[0.03] focus-visible:bg-foreground/[0.04] focus-visible:outline-none"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">
                          {call.outcome ?? call.summary ?? "Appel"}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          <span className="mono">
                            {call.direction === "outbound"
                              ? call.toNumber
                              : call.fromNumber}
                          </span>{" "}
                          ·{" "}
                          {formatDistanceToNow(new Date(call.createdAt), {
                            addSuffix: true,
                            locale: fr,
                          })}
                        </p>
                      </div>
                      <span className="hidden sm:block">
                        <DirectionBadge direction={call.direction} />
                      </span>
                      <span className="hidden whitespace-nowrap text-right text-xs tabular text-muted-foreground sm:block">
                        {formatDuration(call.durationSec)}
                      </span>
                      <CallStatusBadge status={call.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        {/* Colonne latérale */}
        <div className="space-y-5">
          <Card className="p-5">
            <SectionTitle
              icon={Wrench}
              aside={
                <span className="tabular text-sm text-muted-foreground">
                  {displayTools.length}
                </span>
              }
            >
              Outils &amp; fonctions
            </SectionTitle>
            {displayTools.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Aucun outil activé : l&apos;agent répond, mais n&apos;agit pas
                (pas de prise de RDV, de transfert…).
              </p>
            ) : (
              <ul className="mt-3 space-y-1.5">
                {displayTools.map((tool) => (
                  <li
                    key={tool.name}
                    className="flex items-center gap-2.5 rounded-lg border border-border bg-secondary/30 px-3 py-2 text-sm"
                  >
                    <DynamicIcon
                      name={tool.icon}
                      className={cn(
                        "size-4 shrink-0",
                        tool.custom
                          ? "text-brand-700"
                          : "text-muted-foreground",
                      )}
                    />
                    <span className="min-w-0 flex-1 truncate text-foreground/90">
                      {tool.label}
                    </span>
                    {tool.custom && (
                      <span className="rounded bg-brand/10 px-1.5 py-0.5 text-[0.65rem] font-medium text-brand-700">
                        Sur-mesure
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="p-5">
            <SectionTitle icon={ShieldCheck}>Garde-fous</SectionTitle>
            {agent.config.guardrails.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Aucun garde-fou spécifique.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {agent.config.guardrails.map((g, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span
                      className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand"
                      aria-hidden
                    />
                    <span className="text-foreground/90">{g}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
