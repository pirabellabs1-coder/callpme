"use client";

import { useEffect, useState } from "react";
import { Wrench } from "lucide-react";
import type { AgentRole, TranscriptTurn } from "@/lib/shared/types";
import { RoleIcon } from "@/components/role-badge";
import { cn } from "@/lib/utils";
import { formatOffset } from "./format";

/**
 * Transcript en bulles de conversation. Si `audioId` désigne un <audio>
 * présent dans la page (enregistrement réel), les horodatages deviennent
 * des boutons pour s'y rendre et la réplique en cours est mise en évidence.
 * L'élément audio est rendu par le serveur et retrouvé par son id, pour ne
 * pas dupliquer l'enregistrement (data URL) dans la charge utile client.
 */
export function TranscriptView({
  turns,
  agentRole,
  agentName,
  audioId,
}: {
  turns: TranscriptTurn[];
  agentRole: AgentRole;
  agentName?: string;
  audioId?: string;
}) {
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);
  const [active, setActive] = useState(-1);

  useEffect(() => {
    if (!audioId) return;
    const el = document.getElementById(audioId);
    if (!(el instanceof HTMLAudioElement)) return;
    setAudio(el);

    const onTime = () => {
      if (el.paused && el.currentTime === 0) return setActive(-1);
      const t = el.currentTime;
      let idx = -1;
      for (let i = 0; i < turns.length; i++) {
        const turn = turns[i];
        if (turn.speaker !== "agent" && turn.speaker !== "caller") continue;
        if (turn.at <= t) idx = i;
        else break;
      }
      setActive(idx);
    };
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("seeked", onTime);
    return () => {
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("seeked", onTime);
    };
  }, [audioId, turns]);

  function seek(at: number) {
    if (!audio) return;
    audio.currentTime = at;
    void audio.play().catch(() => {});
  }

  if (turns.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Aucune transcription disponible pour cet appel.
      </p>
    );
  }

  return (
    <ol className="space-y-4" aria-label="Transcription de l'appel">
      {turns.map((turn, i) => {
        if (turn.speaker === "tool") {
          return (
            <li key={i} className="flex justify-center">
              <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-border bg-secondary/60 px-3 py-1.5">
                <Wrench className="size-3.5 shrink-0 text-brand" strokeWidth={1.75} aria-hidden="true" />
                <span className="sr-only">Action outil{turn.toolName ? ` ${turn.toolName}` : ""} :</span>
                <code className="truncate font-mono text-[0.72rem] text-foreground/75" title={turn.text}>
                  {turn.text}
                </code>
                <span className="shrink-0 text-[0.65rem] tabular text-muted-foreground">
                  {formatOffset(turn.at)}
                </span>
              </div>
            </li>
          );
        }

        if (turn.speaker === "system") {
          return (
            <li key={i} className="text-center text-xs italic text-muted-foreground">
              {turn.text}
            </li>
          );
        }

        const isAgent = turn.speaker === "agent";
        const isActive = i === active;
        const speakerLabel = isAgent ? agentName || "Agent" : "Appelant";
        return (
          <li
            key={i}
            aria-current={isActive ? "true" : undefined}
            className={cn(
              "flex items-end gap-2.5",
              isAgent ? "justify-start" : "flex-row-reverse justify-start",
            )}
          >
            {isAgent ? (
              <RoleIcon role={agentRole} size="sm" className="shrink-0" />
            ) : (
              <span
                aria-hidden="true"
                className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-[0.7rem] font-semibold text-foreground ring-1 ring-inset ring-border"
              >
                A
              </span>
            )}
            <div
              className={cn(
                "max-w-[78%] rounded-2xl px-3.5 py-2.5 transition-shadow duration-200",
                isAgent
                  ? "rounded-bl-sm border border-border bg-card"
                  : "rounded-br-sm border border-brand/25 bg-brand/[0.12] text-foreground",
                isActive && "ring-2 ring-ring/70 ring-offset-2 ring-offset-background",
              )}
            >
              <p className="text-sm leading-relaxed text-pretty break-words">
                <span className="sr-only">{speakerLabel} : </span>
                {turn.text}
              </p>
              {audio ? (
                <button
                  type="button"
                  onClick={() => seek(turn.at)}
                  aria-label={`Écouter à partir de ${formatOffset(turn.at)}`}
                  className={cn(
                    "mt-1 rounded text-[0.65rem] tabular underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
                    "text-muted-foreground",
                  )}
                >
                  {formatOffset(turn.at)}
                </button>
              ) : (
                <p
                  className={cn(
                    "mt-1 text-[0.65rem] tabular",
                    "text-muted-foreground",
                  )}
                >
                  {formatOffset(turn.at)}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
