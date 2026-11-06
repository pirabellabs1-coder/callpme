import { Check } from "lucide-react";
import { ALL_ROLE_META, ROLE_META } from "@/lib/agents/roles";
import type { AgentRole } from "@/lib/shared/types";
import { DynamicIcon } from "@/components/icon";
import { cn } from "@/lib/utils";

export function RolePicker({
  value,
  onChange,
  labelledBy,
  describedBy,
  firstId,
}: {
  value: AgentRole | null;
  onChange: (role: AgentRole) => void;
  /** id du libellé du groupe. */
  labelledBy?: string;
  /** id d'un message d'erreur associé. */
  describedBy?: string;
  /** id posé sur la première carte (cible du focus en cas d'erreur). */
  firstId?: string;
}) {
  const cards = [...ALL_ROLE_META, ROLE_META.custom];

  return (
    <div
      role="group"
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      className="grid grid-cols-1 gap-3 sm:grid-cols-2"
    >
      {cards.map((meta, i) => {
        const selected = value === meta.key;
        const isCustom = meta.key === "custom";
        return (
          <button
            key={meta.key}
            id={i === 0 ? firstId : undefined}
            type="button"
            onClick={() => onChange(meta.key)}
            aria-pressed={selected}
            className={cn(
              "group relative flex gap-3.5 rounded-xl border p-4 text-left transition-colors duration-150",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/55",
              selected
                ? "border-brand/70 bg-brand/[0.07] ring-1 ring-inset ring-brand/30"
                : "border-border bg-card hover:border-foreground/20 hover:bg-foreground/[0.02]",
              isCustom && !selected && "border-dashed",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "inline-flex size-10 shrink-0 items-center justify-center rounded-lg [&_svg]:size-5",
                meta.iconWrapClass,
              )}
            >
              <DynamicIcon name={meta.icon} />
            </span>
            <span className="block min-w-0 pr-6">
              <span className="block font-semibold tracking-tight text-foreground">
                {meta.label}
              </span>
              <span className="mt-0.5 block text-sm text-muted-foreground text-pretty">
                {meta.tagline}
              </span>
              {!isCustom ? (
                <span className="mt-2 block text-xs text-muted-foreground">
                  {meta.defaultTools.length} outils par défaut ·{" "}
                  {meta.direction === "inbound"
                    ? "Entrant"
                    : meta.direction === "outbound"
                      ? "Sortant"
                      : "Entrant & sortant"}
                </span>
              ) : (
                <span className="mt-2 block text-xs font-medium text-brand-700">
                  Créez votre propre rôle
                </span>
              )}
            </span>
            {selected && (
              <span
                aria-hidden
                className="absolute right-3 top-3 inline-flex size-5 items-center justify-center rounded-full bg-brand text-brand-foreground"
              >
                <Check className="size-3.5" strokeWidth={2.5} />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
