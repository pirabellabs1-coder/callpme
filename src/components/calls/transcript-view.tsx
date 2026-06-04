import { Wrench } from "lucide-react";
import type { AgentRole, TranscriptTurn } from "@/lib/shared/types";
import { RoleIcon } from "@/components/role-badge";
import { cn } from "@/lib/utils";

function ts(at: number): string {
  const m = Math.floor(at / 60);
  const s = at % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function TranscriptView({
  turns,
  agentRole,
}: {
  turns: TranscriptTurn[];
  agentRole: AgentRole;
}) {
  if (turns.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Aucune transcription disponible pour cet appel.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {turns.map((turn, i) => {
        if (turn.speaker === "tool") {
          return (
            <div key={i} className="flex justify-center">
              <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-border bg-secondary/60 px-3 py-1.5">
                <Wrench className="size-3.5 shrink-0 text-brand" strokeWidth={1.75} />
                <code className="truncate font-mono text-[0.72rem] text-foreground/75">
                  {turn.text}
                </code>
              </div>
            </div>
          );
        }

        if (turn.speaker === "system") {
          return (
            <p key={i} className="text-center text-xs italic text-muted-foreground">
              {turn.text}
            </p>
          );
        }

        const isAgent = turn.speaker === "agent";
        return (
          <div
            key={i}
            className={cn(
              "flex items-end gap-2.5",
              isAgent ? "justify-start" : "flex-row-reverse justify-start",
            )}
          >
            {isAgent ? (
              <RoleIcon role={agentRole} size="sm" className="shrink-0" />
            ) : (
              <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-foreground text-[0.7rem] font-semibold text-background">
                A
              </span>
            )}
            <div
              className={cn(
                "max-w-[78%] rounded-2xl px-3.5 py-2.5",
                isAgent
                  ? "rounded-bl-sm border border-border bg-card"
                  : "rounded-br-sm bg-brand text-white",
              )}
            >
              <p className="text-sm leading-relaxed text-pretty">{turn.text}</p>
              <p
                className={cn(
                  "mt-1 text-[0.65rem] tabular",
                  isAgent ? "text-muted-foreground" : "text-white/70",
                )}
              >
                {ts(turn.at)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
