import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Sparkles,
  Star,
  ListTree,
  ExternalLink,
  AudioLines,
  Download,
  CalendarCheck2,
  ListChecks,
  Gauge,
  type LucideIcon,
} from "lucide-react";
import { getCallById } from "@/lib/db/calls";
import { requireSession } from "@/lib/auth/session";
import { getAgentById } from "@/lib/db/agents";
import { prisma } from "@/lib/db/client";
import { getTool } from "@/lib/tools/registry";
import { formatValue } from "@/lib/analysis/fields";
import { parseQuality, SLOW_RESPONSE_MS } from "@/lib/voice-engine/quality";
import { cn, formatDuration } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { RoleIcon, RoleBadge } from "@/components/role-badge";
import { CallStatusBadge, DirectionBadge } from "@/components/status-badges";
import { TranscriptView } from "@/components/calls/transcript-view";
import { CallAudio } from "@/components/calls/call-audio";
import { DeleteCallButton } from "@/components/calls/delete-call-button";
import { DynamicIcon } from "@/components/icon";
import { formatCallDateLong, formatOffset } from "@/components/calls/format";

export const metadata = { title: "Transcript d'appel" };

const SENTIMENT: Record<string, { label: string; cls: string }> = {
  positive: { label: "Positif", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  neutral: { label: "Neutre", cls: "bg-secondary text-foreground/80 ring-border" },
  negative: { label: "Négatif", cls: "bg-rose-50 text-rose-700 ring-rose-200" },
};

const AUDIO_ID = "call-recording";

function KeyValue({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <dt className="shrink-0 text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-right text-sm font-medium text-foreground">
        {children}
      </dd>
    </div>
  );
}

function SectionTitle({
  icon: Icon,
  children,
}: {
  icon?: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <h2 className="flex items-center gap-2 text-[0.95rem] font-semibold tracking-tight">
      {Icon && <Icon className="size-4 text-muted-foreground" aria-hidden />}
      {children}
    </h2>
  );
}

export default async function CallTranscriptPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await requireSession();
  const call = await getCallById(params.id, session.org.id);
  if (!call) notFound();

  const [evaluation, agent, appointments, leads, qualityRow] = await Promise.all([
    prisma.evaluation.findUnique({ where: { callId: call.id } }),
    getAgentById(call.agentId),
    prisma.appointment.findMany({
      where: { organizationId: session.org.id, callRef: call.id },
      select: { id: true, reference: true, customerName: true, startsAt: true, status: true },
    }),
    prisma.lead.findMany({
      where: { organizationId: session.org.id, callRef: call.id },
      select: { id: true, kind: true, name: true, score: true },
    }),
    prisma.call.findUnique({ where: { id: call.id }, select: { quality: true } }),
  ]);
  const quality = parseQuality(qualityRow?.quality);
  const seconds = (ms: number | null) => (ms === null ? "—" : `${(ms / 1000).toFixed(1).replace(".", ",")} s`);
  const fieldLabels = new Map((agent?.config.analysis?.fields ?? []).map((f) => [f.key, f.label]));
  const KIND_LABEL: Record<string, string> = { lead: "Prospect", message: "Message", callback: "Rappel à faire", ticket: "Ticket" };
  const role = call.agentRole ?? "support";
  const toolTurns = call.transcript.filter((t) => t.speaker === "tool");
  const spokenTurns = call.transcript.filter(
    (t) => t.speaker === "agent" || t.speaker === "caller",
  ).length;
  const sentiment = evaluation?.sentiment ? SENTIMENT[evaluation.sentiment] : undefined;
  const longDate = formatCallDateLong(call.createdAt);

  // Voix de l'agent (pour reconstituer l'audio) : genre + langue.
  const voice = agent?.config.voice;
  const catalogVoice = voice?.providerVoiceId
    ? await prisma.platformVoice.findUnique({ where: { externalId: voice.providerVoiceId }, select: { gender: true } })
    : null;
  const audioGender = (catalogVoice?.gender ?? null) as "feminine" | "masculine" | "neutral" | null;
  const audioLang = voice?.language || "fr-FR";

  return (
    <div className="space-y-6">
      <Link
        href="/calls"
        className="inline-flex items-center gap-1.5 rounded text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Retour aux appels
      </Link>

      {/* En-tête */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <RoleIcon role={role} size="lg" />
          <div className="min-w-0">
            <h1 className="text-display-sm font-semibold tracking-tight text-balance">
              {call.outcome ?? "Appel"}
            </h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-muted-foreground">
              <Link
                href={`/agents/${call.agentId}`}
                className="inline-flex items-center gap-1.5 font-medium text-foreground hover:text-brand"
              >
                {call.agentName}
                <ExternalLink className="size-3" aria-hidden="true" />
              </Link>
              <RoleBadge role={role} />
              <DirectionBadge direction={call.direction} />
              <time dateTime={call.createdAt}>{longDate}</time>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <CallStatusBadge status={call.status} />
          <DeleteCallButton callId={call.id} />
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        {/* Colonne principale : écoute + transcript */}
        <section className="min-w-0 space-y-5" aria-label="Enregistrement et transcription">
          {call.audioUrl ? (
            <Card className="p-5">
              <h2 className="flex items-center gap-2 text-[0.95rem] font-semibold tracking-tight">
                <AudioLines className="size-4 text-brand" aria-hidden="true" />
                Écouter l&apos;appel
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Enregistrement réel de l&apos;appel. Cliquez sur l&apos;horodatage
                d&apos;une réplique pour vous y rendre.
              </p>
              {/* eslint-disable-next-line jsx-a11y/media-has-caption -- le transcript ci-dessous tient lieu de sous-titres */}
              <audio
                id={AUDIO_ID}
                controls
                preload="metadata"
                src={call.audioUrl}
                className="mt-3 w-full"
                aria-label="Enregistrement de l'appel"
              />
              <a
                href={call.audioUrl}
                download={`appel-${call.id}.webm`}
                className="mt-3 inline-flex items-center gap-1.5 rounded text-sm font-medium text-brand-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
              >
                <Download className="size-4" aria-hidden="true" />
                Télécharger l&apos;enregistrement
              </a>
            </Card>
          ) : (
            <CallAudio
              turns={call.transcript}
              agentGender={audioGender}
              language={audioLang}
            />
          )}

          <Card className="p-5">
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-[0.95rem] font-semibold tracking-tight">Transcription</h2>
              <span className="text-xs tabular text-muted-foreground">
                {spokenTurns} réplique{spokenTurns > 1 ? "s" : ""} ·{" "}
                {formatDuration(call.durationSec)}
              </span>
            </div>
            <TranscriptView
              turns={call.transcript}
              agentRole={role}
              agentName={call.agentName}
              audioId={call.audioUrl ? AUDIO_ID : undefined}
            />
          </Card>
        </section>

        {/* Colonne latérale : analyse + métadonnées */}
        <aside className="space-y-5 lg:sticky lg:top-6" aria-label="Analyse et détails de l'appel">
          <Card className="border-brand/20 bg-brand/[0.06] p-5">
            <h2 className="flex items-center gap-2 text-[0.95rem] font-semibold tracking-tight">
              <Sparkles className="size-4 text-brand" aria-hidden="true" />
              Résumé IA
            </h2>
            <p className="mt-2.5 text-sm leading-relaxed text-foreground/90 text-pretty">
              {call.summary || "Aucun résumé n'a été généré pour cet appel."}
            </p>
          </Card>

          <Card className="p-5">
            <SectionTitle icon={Star}>Évaluation IA</SectionTitle>
            {evaluation ? (
              <>
                <div className="mt-3 flex items-center gap-4">
                  <span
                    className={cn(
                      "tabular text-display-sm font-semibold tracking-tight",
                      evaluation.successScore >= 70
                        ? "text-emerald-600"
                        : evaluation.successScore >= 45
                          ? "text-amber-600"
                          : "text-destructive",
                    )}
                  >
                    {evaluation.successScore}
                    <span className="sr-only"> sur 100</span>
                  </span>
                  <div className="text-sm">
                    <p className="font-medium text-foreground" aria-hidden="true">
                      / 100
                    </p>
                    <p className="text-muted-foreground">
                      {evaluation.goalAchieved ? "Objectif atteint" : "Objectif non atteint"}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Sentiment</span>
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
                      (sentiment ?? SENTIMENT.neutral).cls,
                    )}
                  >
                    {sentiment?.label ?? "Non mesuré"}
                  </span>
                </div>
                {evaluation.summary && (
                  <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                    {evaluation.summary}
                  </p>
                )}
              </>
            ) : (
              <p className="mt-2.5 text-sm text-muted-foreground">
                Cet appel n&apos;a pas encore été évalué.
              </p>
            )}
          </Card>

          {call.extracted && Object.keys(call.extracted).length > 0 && (
            <Card className="p-5">
              <SectionTitle icon={ListChecks}>Données relevées</SectionTitle>
              <dl className="mt-2 divide-y divide-border">
                {Object.entries(call.extracted).map(([key, value]) => (
                  <KeyValue key={key} label={fieldLabels.get(key) ?? key}>
                    <span className={value === null ? "font-normal text-muted-foreground" : ""}>{formatValue(value)}</span>
                  </KeyValue>
                ))}
              </dl>
            </Card>
          )}

          {(appointments.length > 0 || leads.length > 0) && (
            <Card className="border-emerald-500/20 p-5">
              <SectionTitle icon={CalendarCheck2}>Résultats de l&apos;appel</SectionTitle>
              <ul className="mt-3 space-y-2 text-sm">
                {appointments.map((a) => (
                  <li key={a.id}>
                    <Link href="/appointments" className="flex items-baseline justify-between gap-3 rounded-lg px-2 py-1.5 hover:bg-foreground/[0.04]">
                      <span>
                        Rendez-vous{a.status === "cancelled" ? " (annulé)" : ""} · {a.customerName}
                      </span>
                      <span className="mono text-xs text-muted-foreground">{a.reference}</span>
                    </Link>
                  </li>
                ))}
                {leads.map((l) => (
                  <li key={l.id}>
                    <Link href="/leads" className="flex items-baseline justify-between gap-3 rounded-lg px-2 py-1.5 hover:bg-foreground/[0.04]">
                      <span>
                        {KIND_LABEL[l.kind] ?? l.kind} · {l.name}
                      </span>
                      {l.score != null && <span className="text-xs tabular-nums text-muted-foreground">{l.score}/100</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card className="p-5">
            <SectionTitle>Détails</SectionTitle>
            <dl className="mt-2 divide-y divide-border">
              <KeyValue label="Agent">
                <Link href={`/agents/${call.agentId}`} className="hover:text-brand">
                  {call.agentName ?? "Agent"}
                </Link>
              </KeyValue>
              <KeyValue label="Statut">
                <CallStatusBadge status={call.status} />
              </KeyValue>
              <KeyValue label="Direction">
                <DirectionBadge direction={call.direction} />
              </KeyValue>
              <KeyValue label="De">
                <span className="mono">{call.fromNumber}</span>
              </KeyValue>
              <KeyValue label="Vers">
                <span className="mono">{call.toNumber}</span>
              </KeyValue>
              <KeyValue label="Durée">
                <span className="tabular">{formatDuration(call.durationSec)}</span>
              </KeyValue>
              <KeyValue label="Issue">{call.outcome ?? "—"}</KeyValue>
              <KeyValue label="Satisfaction">
                {call.satisfaction != null ? (
                  <span
                    className="inline-flex items-center gap-0.5"
                    role="img"
                    aria-label={`${call.satisfaction} sur 5`}
                  >
                    {Array.from({ length: 5 }, (_, i) => (
                      <Star
                        key={i}
                        aria-hidden="true"
                        className={cn(
                          "size-3.5",
                          i < call.satisfaction!
                            ? "fill-amber-400 text-amber-400"
                            : "text-muted-foreground/40",
                        )}
                      />
                    ))}
                  </span>
                ) : (
                  <span className="font-normal text-muted-foreground">Non mesurée</span>
                )}
              </KeyValue>
              <KeyValue label="Identifiant">
                <span className="mono text-xs font-normal text-muted-foreground">{call.id}</span>
              </KeyValue>
            </dl>
          </Card>

          {quality && quality.turns > 0 && (
            <Card className="p-5">
              <SectionTitle icon={Gauge}>Qualité technique</SectionTitle>
              <dl className="mt-2 divide-y divide-border">
                <KeyValue label="Temps de réponse moyen">
                  <span
                    className={cn(
                      "tabular",
                      quality.responseAvgMs !== null && quality.responseAvgMs > SLOW_RESPONSE_MS && "text-destructive",
                    )}
                  >
                    {seconds(quality.responseAvgMs)}
                  </span>
                </KeyValue>
                <KeyValue label="Plus long blanc (95 %)">
                  <span className="tabular">{seconds(quality.responseP95Ms)}</span>
                </KeyValue>
                <KeyValue label="Dont modèle / voix">
                  <span className="tabular">
                    {seconds(quality.llmAvgMs)} / {seconds(quality.ttsAvgMs)}
                  </span>
                </KeyValue>
                <KeyValue label="Interruptions">
                  <span className="tabular">{quality.interruptions}</span>
                </KeyValue>
              </dl>
              {quality.issues.length > 0 ? (
                <ul className="mt-3 space-y-1 text-xs text-amber-600 dark:text-amber-400">
                  {quality.issues.map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-xs text-muted-foreground">Aucun problème technique détecté.</p>
              )}
            </Card>
          )}

          {toolTurns.length > 0 && (
            <Card className="p-5">
              <SectionTitle icon={ListTree}>Outils utilisés</SectionTitle>
              <ul className="mt-3 space-y-3">
                {toolTurns.map((turn, i) => {
                  const tool = turn.toolName ? getTool(turn.toolName) : undefined;
                  return (
                    <li key={i} className="flex items-start gap-3">
                      <span
                        aria-hidden="true"
                        className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-foreground/60 ring-1 ring-inset ring-border [&_svg]:size-4"
                      >
                        <DynamicIcon name={tool?.icon ?? "Wrench"} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground">
                          {tool?.label ?? turn.toolName ?? "Outil"}
                        </p>
                        {turn.text && <p className="mt-0.5 text-xs text-muted-foreground text-pretty">{turn.text}</p>}
                        <p className="text-[0.7rem] tabular text-muted-foreground">
                          à {formatOffset(turn.at)}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}
