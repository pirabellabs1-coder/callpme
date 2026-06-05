import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Sparkles,
  Star,
  ListTree,
  ExternalLink,
} from "lucide-react";
import { getCallById } from "@/lib/db/calls";
import { getAgentById } from "@/lib/db/agents";
import { getPresetVoice } from "@/lib/voices/catalog";
import { prisma } from "@/lib/db/client";
import { ROLE_META } from "@/lib/agents/roles";
import { getTool } from "@/lib/tools/registry";
import { cn, formatDuration } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { RoleIcon, RoleBadge } from "@/components/role-badge";
import { CallStatusBadge, DirectionBadge } from "@/components/status-badges";
import { TranscriptView } from "@/components/calls/transcript-view";
import { CallAudio } from "@/components/calls/call-audio";
import { DeleteCallButton } from "@/components/calls/delete-call-button";
import { DynamicIcon } from "@/components/icon";

export const metadata = { title: "Transcript d'appel" };

const dateFmt = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "long",
  timeStyle: "short",
});

function KeyValue({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-medium text-foreground">
        {children}
      </span>
    </div>
  );
}

export default async function CallTranscriptPage({
  params,
}: {
  params: { id: string };
}) {
  const call = await getCallById(params.id);
  if (!call) notFound();

  const [evaluation, agent] = await Promise.all([
    prisma.evaluation.findUnique({ where: { callId: call.id } }),
    getAgentById(call.agentId),
  ]);
  const role = call.agentRole ?? "support";
  const toolTurns = call.transcript.filter((t) => t.speaker === "tool");

  // Voix de l'agent (pour reconstituer l'audio) : genre + langue.
  const voice = agent?.config.voice;
  const presetGender = voice?.voiceId ? getPresetVoice(voice.voiceId)?.gender : undefined;
  const audioGender = (presetGender ?? null) as "feminine" | "masculine" | "neutral" | null;
  const audioLang = voice?.language || "fr-FR";

  return (
    <div className="space-y-6">
      <Link
        href="/calls"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Appels
      </Link>

      {/* En-tête */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <RoleIcon role={role} size="lg" />
          <div>
            <h1 className="text-display-sm font-semibold tracking-tight">
              {call.outcome ?? "Appel"}
            </h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              <Link
                href={`/agents/${call.agentId}`}
                className="inline-flex items-center gap-1.5 font-medium text-foreground hover:text-brand"
              >
                {call.agentName}
                <ExternalLink className="size-3" />
              </Link>
              <RoleBadge role={role} />
              <span>{dateFmt.format(new Date(call.createdAt))}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <CallStatusBadge status={call.status} />
          <DeleteCallButton callId={call.id} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* Colonne principale */}
        <div className="space-y-5 lg:col-span-2">
          <CallAudio
            callId={call.id}
            turns={call.transcript}
            agentGender={audioGender}
            language={audioLang}
          />
          <Card className="p-5">
            <h2 className="mb-4 text-[0.95rem] font-semibold tracking-tight">
              Transcription
            </h2>
            <TranscriptView turns={call.transcript} agentRole={role} />
          </Card>
        </div>

        {/* Colonne latérale */}
        <div className="space-y-5">
          {call.summary && (
            <Card className="border-brand/20 bg-brand-50/30 p-5">
              <h2 className="flex items-center gap-2 text-[0.95rem] font-semibold tracking-tight">
                <Sparkles className="size-4 text-brand" />
                Résumé IA
              </h2>
              <p className="mt-2.5 text-sm leading-relaxed text-foreground/90 text-pretty">
                {call.summary}
              </p>
            </Card>
          )}

          {evaluation && (
            <Card className="p-5">
              <h2 className="flex items-center gap-2 text-[0.95rem] font-semibold tracking-tight">
                <Star className="size-4 text-muted-foreground" />
                Évaluation IA
              </h2>
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
                </span>
                <div className="text-sm">
                  <p className="font-medium text-foreground">/ 100</p>
                  <p className="text-muted-foreground">
                    {evaluation.goalAchieved ? "Objectif atteint" : "À améliorer"} ·{" "}
                    {evaluation.sentiment === "positive"
                      ? "positif"
                      : evaluation.sentiment === "negative"
                        ? "négatif"
                        : "neutre"}
                  </p>
                </div>
              </div>
              {evaluation.summary && (
                <p className="mt-3 text-xs text-muted-foreground">{evaluation.summary}</p>
              )}
            </Card>
          )}

          <Card className="p-5">
            <h2 className="text-[0.95rem] font-semibold tracking-tight">
              Détails
            </h2>
            <div className="mt-2 divide-y divide-border">
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
                {formatDuration(call.durationSec)}
              </KeyValue>
              <KeyValue label="Issue">{call.outcome ?? "—"}</KeyValue>
              {call.satisfaction != null && (
                <KeyValue label="Satisfaction">
                  <span className="inline-flex items-center gap-0.5">
                    {Array.from({ length: 5 }, (_, i) => (
                      <Star
                        key={i}
                        className={cn(
                          "size-3.5",
                          i < call.satisfaction!
                            ? "fill-amber-400 text-amber-400"
                            : "text-border",
                        )}
                      />
                    ))}
                  </span>
                </KeyValue>
              )}
            </div>
          </Card>

          {toolTurns.length > 0 && (
            <Card className="p-5">
              <h2 className="flex items-center gap-2 text-[0.95rem] font-semibold tracking-tight">
                <ListTree className="size-4 text-muted-foreground" />
                Outils utilisés
              </h2>
              <div className="mt-3 space-y-3">
                {toolTurns.map((turn, i) => {
                  const tool = turn.toolName ? getTool(turn.toolName) : undefined;
                  return (
                    <div key={i} className="flex items-start gap-3">
                      <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-foreground/60 ring-1 ring-inset ring-border [&_svg]:size-4">
                        <DynamicIcon name={tool?.icon ?? "Wrench"} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground">
                          {tool?.label ?? turn.toolName}
                        </p>
                        <p className="text-[0.7rem] tabular text-muted-foreground">
                          à {Math.floor(turn.at / 60)}:
                          {String(turn.at % 60).padStart(2, "0")}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
