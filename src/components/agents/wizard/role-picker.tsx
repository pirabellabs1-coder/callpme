import { Check } from "lucide-react";
import { ALL_ROLE_META, ROLE_META } from "@/lib/agents/roles";
import type { AgentRole } from "@/lib/shared/types";
import { DynamicIcon } from "@/components/icon";
import { cn } from "@/lib/utils";

export function RolePicker({
  value,
  onChange,
}: {
  value: AgentRole | null;
  onChange: (role: AgentRole) => void;
}) {
  const cards = [...ALL_ROLE_META, ROLE_META.custom];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {cards.map((meta) => {
        const selected = value === meta.key;
        const isCustom = meta.key === "custom";
        return (
          <button
            key={meta.key}
            type="button"
            onClick={() => onChange(meta.key)}
            aria-pressed={selected}
            className={cn(
              "group relative flex gap-3.5 rounded-xl border p-4 text-left transition-all duration-150",
              selected
                ? "border-brand bg-brand-50/40 ring-2 ring-brand/20"
                : "border-border bg-card hover:border-foreground/20 hover:shadow-sm",
              isCustom && !selected && "border-dashed",
            )}
          >
            <span
              className={cn(
                "inline-flex size-10 shrink-0 items-center justify-center rounded-lg [&_svg]:size-5",
                meta.iconWrapClass,
              )}
            >
              <DynamicIcon name={meta.icon} />
            </span>
            <div className="min-w-0">
              <h3 className="font-semibold tracking-tight text-foreground">
                {meta.label}
              </h3>
              <p className="mt-0.5 text-sm text-muted-foreground text-pretty">
                {meta.tagline}
              </p>
              {!isCustom ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  {meta.defaultTools.length} outils par défaut ·{" "}
                  {meta.direction === "inbound"
                    ? "Entrant"
                    : meta.direction === "outbound"
                      ? "Sortant"
                      : "Entrant & sortant"}
                </p>
              ) : (
                <p className="mt-2 text-xs font-medium text-brand">
                  Créez votre propre rôle
                </p>
              )}
            </div>
            {selected && (
              <span className="absolute right-3 top-3 inline-flex size-5 items-center justify-center rounded-full bg-brand text-white">
                <Check className="size-3.5" strokeWidth={2.5} />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
