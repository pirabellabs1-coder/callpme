"use client";

import { useState } from "react";
import { FunctionSquare, Plus } from "lucide-react";
import { toolsByCategory, TOOL_CATEGORY_LABELS } from "@/lib/tools/registry";
import type { CustomToolRecord } from "@/lib/shared/types";
import { DynamicIcon } from "@/components/icon";
import { Switch } from "@/components/ui/switch";
import { ToolBuilder } from "@/components/dev/tool-builder";
import { cn } from "@/lib/utils";

function Row({
  on,
  onToggle,
  icon,
  label,
  name,
  description,
  badge,
}: {
  on: boolean;
  onToggle: () => void;
  icon: React.ReactNode;
  label: string;
  name: string;
  description: string;
  badge?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border p-3 transition-colors",
        on ? "border-brand/30 bg-brand-50/30" : "border-border bg-card",
      )}
    >
      <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-foreground/60 ring-1 ring-inset ring-border [&_svg]:size-4">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium text-foreground">{label}</p>
          {badge && (
            <span className="rounded bg-secondary px-1.5 py-0.5 text-[0.65rem] font-medium text-muted-foreground">
              {badge}
            </span>
          )}
          <code className="hidden font-mono text-[0.7rem] text-muted-foreground sm:inline">
            {name}
          </code>
        </div>
        <p className="truncate text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={on} onCheckedChange={onToggle} aria-label={label} />
    </div>
  );
}

export function ToolsPicker({
  selected,
  onToggle,
  roleDefaults,
  customTools = [],
  onCreated,
}: {
  selected: string[];
  onToggle: (name: string) => void;
  roleDefaults: string[];
  customTools?: CustomToolRecord[];
  onCreated?: (tool: CustomToolRecord) => void;
}) {
  const grouped = toolsByCategory();
  const [builderOpen, setBuilderOpen] = useState(false);

  return (
    <div className="space-y-5">
      {/* Fonctions personnalisées */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">
            Fonctions personnalisées
          </p>
          <button
            type="button"
            onClick={() => setBuilderOpen(true)}
            className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:text-brand-700"
          >
            <Plus className="size-3" />
            Créer une fonction
          </button>
        </div>
        {customTools.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border bg-card/50 px-3 py-3 text-xs text-muted-foreground">
            Aucune fonction personnalisée. Créez-en dans Développeurs › Fonctions
            pour collecter des données et les envoyer vers vos systèmes.
          </p>
        ) : (
          <div className="space-y-2">
            {customTools.map((tool) => (
              <Row
                key={tool.name}
                on={selected.includes(tool.name)}
                onToggle={() => onToggle(tool.name)}
                icon={<FunctionSquare className="text-brand" />}
                label={tool.label}
                name={tool.name}
                description={tool.description}
                badge="Sur-mesure"
              />
            ))}
          </div>
        )}
      </div>

      {/* Outils intégrés */}
      {Object.entries(grouped).map(([cat, tools]) => (
        <div key={cat}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">
            {TOOL_CATEGORY_LABELS[cat] ?? cat}
          </p>
          <div className="space-y-2">
            {tools.map((tool) => (
              <Row
                key={tool.name}
                on={selected.includes(tool.name)}
                onToggle={() => onToggle(tool.name)}
                icon={<DynamicIcon name={tool.icon} />}
                label={tool.label}
                name={tool.name}
                description={tool.description}
                badge={roleDefaults.includes(tool.name) ? "Recommandé" : undefined}
              />
            ))}
          </div>
        </div>
      ))}

      {builderOpen && (
        <ToolBuilder
          onClose={() => setBuilderOpen(false)}
          onCreated={(tool) => {
            onCreated?.(tool);
            setBuilderOpen(false);
          }}
        />
      )}
    </div>
  );
}
