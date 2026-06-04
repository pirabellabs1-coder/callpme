import { Volume2, Cpu, Languages, Wrench, Thermometer, Ear } from "lucide-react";
import type { AgentRole, FirstSpeaker } from "@/lib/shared/types";
import { ROLE_META } from "@/lib/agents/roles";
import { languageLabel } from "@/lib/agents/catalog";
import { RoleIcon, RoleBadge } from "@/components/role-badge";

function VoiceBars() {
  const bars = [0, 1, 2, 3, 4];
  return (
    <div className="flex h-4 items-center gap-0.5" aria-hidden>
      {bars.map((i) => (
        <span
          key={i}
          className="w-0.5 rounded-full bg-brand/70 animate-[pulse_1.1s_ease-in-out_infinite]"
          style={{
            height: `${[40, 80, 100, 70, 50][i]}%`,
            animationDelay: `${i * 0.12}s`,
          }}
        />
      ))}
    </div>
  );
}

function Chip({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Volume2;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/50 px-2.5 py-2">
      <Icon className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={1.75} />
      <div className="min-w-0">
        <p className="truncate text-[0.65rem] uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="truncate text-xs font-medium text-foreground">{value}</p>
      </div>
    </div>
  );
}

export function CallPreview({
  name,
  role,
  roleLabel,
  firstMessage,
  firstSpeaker = "agent",
  voiceLabel,
  language,
  modelLabel,
  temperature,
  toolsCount,
}: {
  name: string;
  role: AgentRole;
  roleLabel?: string;
  firstMessage: string;
  firstSpeaker?: FirstSpeaker;
  voiceLabel: string;
  language: string;
  modelLabel: string;
  temperature: number;
  toolsCount: number;
}) {
  const callerFirst = firstSpeaker === "caller";

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-md">
      {/* En-tête appel */}
      <div className="flex items-center gap-3 border-b border-border bg-secondary/40 px-5 py-4">
        <RoleIcon role={role} size="md" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold tracking-tight text-foreground">
            {name || "Nouvel agent"}
          </p>
          <div className="mt-1">
            <RoleBadge role={role} label={roleLabel} />
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[0.7rem] font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/15">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            Aperçu
          </span>
          <VoiceBars />
        </div>
      </div>

      {/* Ouverture de l'appel */}
      <div className="px-5 py-5">
        {callerFirst ? (
          <>
            <p className="mb-2 flex items-center gap-1.5 text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">
              <Ear className="size-3.5" />
              L'appelant parle en premier
            </p>
            <div className="rounded-xl border border-dashed border-border bg-background px-4 py-3">
              <p className="text-sm leading-relaxed text-muted-foreground text-pretty">
                L'agent reste silencieux au décroché, écoute la demande, puis
                répond.
              </p>
            </div>
          </>
        ) : (
          <>
            <p className="mb-2 text-[0.7rem] font-medium uppercase tracking-wide text-muted-foreground">
              L'agent décroche et dit
            </p>
            <div className="relative rounded-xl rounded-tl-sm border border-border bg-background px-4 py-3">
              <p className="text-sm leading-relaxed text-foreground text-pretty">
                {firstMessage || ROLE_META[role].firstMessage}
              </p>
            </div>
          </>
        )}
      </div>

      {/* Config */}
      <div className="grid grid-cols-2 gap-2 px-5 pb-5">
        <Chip icon={Volume2} label="Voix" value={voiceLabel} />
        <Chip icon={Languages} label="Langue" value={languageLabel(language)} />
        <Chip icon={Cpu} label="Modèle" value={modelLabel} />
        <Chip icon={Thermometer} label="Température" value={temperature.toFixed(1)} />
        <Chip
          icon={Wrench}
          label="Outils actifs"
          value={`${toolsCount} outil${toolsCount > 1 ? "s" : ""}`}
        />
      </div>
    </div>
  );
}
