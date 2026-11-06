"use client";

import { Sparkles } from "lucide-react";
import type { AgentRole } from "@/lib/shared/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RolePicker } from "./role-picker";
import { FieldError, errorId, fieldId, invalidProps } from "./controls";
import type { SetWizardState, StepErrors, WizardState } from "./state";

export function StepIdentity({
  s,
  set,
  errors,
  onSelectRole,
}: {
  s: WizardState;
  set: SetWizardState;
  errors: StepErrors;
  onSelectRole: (role: AgentRole) => void;
}) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor={fieldId("name")}>Nom de l&apos;agent</Label>
        <Input
          id={fieldId("name")}
          value={s.name}
          onChange={(e) => set({ name: e.target.value })}
          placeholder="Ex : Camille — Accueil du cabinet"
          maxLength={80}
          autoComplete="off"
          required
          {...invalidProps("name", errors.name)}
        />
        <FieldError name="name" message={errors.name} />
      </div>

      <div className="space-y-2">
        <p id="role-label" className="text-sm font-medium text-foreground">
          Que doit faire votre agent ?
        </p>
        <RolePicker
          value={s.role}
          onChange={onSelectRole}
          labelledBy="role-label"
          describedBy={errors.role ? errorId("role") : undefined}
          firstId={fieldId("role")}
        />
        <FieldError name="role" message={errors.role} />
      </div>

      {s.role === "custom" && (
        <div className="space-y-4 rounded-xl border border-brand/25 bg-brand/[0.05] p-4">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-brand" aria-hidden />
            <p className="text-sm font-medium text-foreground">
              Définissez votre rôle
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor={fieldId("customRoleLabel")}>Nom du rôle</Label>
            <Input
              id={fieldId("customRoleLabel")}
              value={s.customRoleLabel}
              onChange={(e) => set({ customRoleLabel: e.target.value })}
              placeholder="Ex : Conciergerie, Recouvrement, Hotline technique…"
              maxLength={80}
              required
              {...invalidProps("customRoleLabel", errors.customRoleLabel)}
            />
            <FieldError
              name="customRoleLabel"
              message={errors.customRoleLabel}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="crole-desc">Mission de l&apos;agent</Label>
            <Textarea
              id="crole-desc"
              value={s.customRoleDescription}
              onChange={(e) => set({ customRoleDescription: e.target.value })}
              rows={3}
              maxLength={2000}
              placeholder="Décrivez ce que l'agent doit accomplir, son périmètre et ses règles clés."
            />
          </div>
        </div>
      )}
    </>
  );
}
