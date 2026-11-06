"use client";

import Link from "next/link";
import type { CustomToolRecord } from "@/lib/shared/types";
import { ROLE_META } from "@/lib/agents/roles";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { ToolsPicker } from "./tools-picker";
import { GuardrailsEditor } from "./guardrails-editor";
import type { SetWizardState, StepErrors, WizardState } from "./state";

export function StepTools({
  s,
  set,
  errors,
  customTools,
  knowledgeBases,
  onToggleTool,
  onToolCreated,
}: {
  s: WizardState;
  set: SetWizardState;
  errors: StepErrors;
  customTools: CustomToolRecord[];
  knowledgeBases: { id: string; name: string }[];
  onToggleTool: (name: string) => void;
  onToolCreated: (tool: CustomToolRecord) => void;
}) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="kb">Base de connaissances (optionnel)</Label>
        <Select
          id="kb"
          value={s.knowledgeBaseId}
          onChange={(e) => set({ knowledgeBaseId: e.target.value })}
          aria-describedby="kb-hint"
        >
          <option value="">Aucune</option>
          {knowledgeBases.map((kb) => (
            <option key={kb.id} value={kb.id}>
              {kb.name}
            </option>
          ))}
        </Select>
        <p id="kb-hint" className="text-xs text-muted-foreground">
          {knowledgeBases.length === 0 ? (
            <>
              Aucune base pour l&apos;instant.{" "}
              <Link
                href="/knowledge"
                className="text-brand-700 hover:underline"
              >
                Créez-en une
              </Link>{" "}
              (FAQ, tarifs, horaires…) pour que l&apos;agent réponde avec vos
              informations.
            </>
          ) : (
            "L'agent s'appuiera sur les documents de cette base pour répondre."
          )}
        </p>
      </div>

      <div className="space-y-2">
        <div>
          <p className="text-sm font-medium text-foreground">
            Actions de l&apos;agent
          </p>
          <p className="text-xs text-muted-foreground">
            Ce que l&apos;agent peut faire pendant l&apos;appel. Les outils «
            Recommandé » correspondent au rôle choisi.
          </p>
        </div>
        <ToolsPicker
          selected={s.tools}
          onToggle={onToggleTool}
          roleDefaults={s.role ? ROLE_META[s.role].defaultTools : []}
          customTools={customTools}
          onCreated={onToolCreated}
        />
      </div>

      <GuardrailsEditor
        guardrails={s.guardrails}
        onChange={(g) => set({ guardrails: g })}
        error={errors.guardrails}
      />
    </>
  );
}
