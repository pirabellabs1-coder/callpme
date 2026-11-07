"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  FileText,
  Loader2,
} from "lucide-react";
import type {
  Agent,
  AgentRole,
  CustomToolRecord,
  PhoneNumberRecord,
} from "@/lib/shared/types";
import { ROLE_META } from "@/lib/agents/roles";
import type { AgentTemplate } from "@/lib/agents/templates";
import { generateSystemPrompt } from "@/lib/agents/role-templates";
import { MODELS } from "@/lib/agents/catalog";
import { Button } from "@/components/ui/button";
import { CallPreview } from "./wizard/call-preview";
import { Stepper } from "./wizard/stepper";
import { StepShell, fieldId } from "./wizard/controls";
import { StepIdentity } from "./wizard/step-identity";
import { StepVoice } from "./wizard/step-voice";
import { StepConversation } from "./wizard/step-conversation";
import { StepTools } from "./wizard/step-tools";
import { StepTelephony } from "./wizard/step-telephony";
import {
  LAST_STEP,
  STEPS,
  buildPayload,
  firstInvalidStep,
  followGreeting,
  initialState,
  suggestedGreeting,
  promptParams,
  validateStep,
  type StepErrors,
  type StudioVoiceOption,
  type WizardState,
} from "./wizard/state";

const STEP_DESCRIPTIONS: Record<number, string> = {
  1: "Nommez votre agent et choisissez sa mission.",
  2: "Choisissez la voix que vos clients entendront.",
  3: "Comment l'agent ouvre l'appel et se comporte.",
  4: "Ce que l'agent sait, ce qu'il peut faire, et ses limites.",
  5: "Assignez un numéro et choisissez l'état de l'agent.",
};

/** Champs situés dans les « Réglages avancés » de l'étape Conversation. */
const ADVANCED_FIELDS = new Set(["modelId", "systemPrompt"]);

export function AgentWizard({
  organizationName,
  usedNumbers,
  availableNumbers,
  customTools,
  knowledgeBases,
  studioVoices,
  template,
  agent,
}: {
  organizationName: string;
  usedNumbers: string[];
  availableNumbers: PhoneNumberRecord[];
  customTools: CustomToolRecord[];
  knowledgeBases: { id: string; name: string }[];
  studioVoices: StudioVoiceOption[];
  template?: AgentTemplate;
  agent?: Agent;
}) {
  const router = useRouter();
  const isEdit = Boolean(agent);
  const [step, setStep] = useState(1);
  // En édition, toutes les étapes sont déjà renseignées.
  const [maxReached, setMaxReached] = useState(isEdit ? LAST_STEP : 1);
  const [s, setS] = useState<WizardState>(() => {
    const init = initialState(agent, template);
    // Voix inconnue (ancienne voix supprimée) ou nouvel agent : première voix du catalogue.
    const known = studioVoices.some((v) => v.id === init.voiceId);
    return known || !studioVoices[0] ? init : { ...init, voiceId: studioVoices[0].id };
  });
  const [showErrors, setShowErrors] = useState(false);
  const [promptDirty, setPromptDirty] = useState(isEdit);
  const [firstMsgDirty, setFirstMsgDirty] = useState(isEdit);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [submitting, setSubmitting] = useState<"draft" | "final" | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [customToolsState, setCustomToolsState] = useState(customTools);

  const headingRef = useRef<HTMLHeadingElement>(null);
  const pendingFocus = useRef<string | null>(null);
  const prevStep = useRef(step);

  const set = (patch: Partial<WizardState>) =>
    setS((prev) => ({ ...prev, ...patch }));

  // Erreurs dérivées : elles disparaissent dès que le champ est corrigé.
  const errors: StepErrors = showErrors ? validateStep(step, s) : {};
  const hasErrors = Object.keys(errors).length > 0;

  // Régénération du prompt système depuis le rôle (tant que non édité à la main).
  useEffect(() => {
    if (s.role && !promptDirty) {
      setS((prev) => ({
        ...prev,
        systemPrompt: generateSystemPrompt(
          promptParams(prev, organizationName),
        ),
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    s.role,
    s.name,
    s.guardrails,
    s.persona,
    s.tools,
    s.firstSpeaker,
    s.customRoleLabel,
    s.customRoleDescription,
    promptDirty,
  ]);

  // Changement d'étape : focus sur le premier champ en erreur, sinon sur le titre.
  useEffect(() => {
    const stepChanged = prevStep.current !== step;
    prevStep.current = step;
    const key = pendingFocus.current;
    if (!key && !stepChanged) return;
    pendingFocus.current = null;
    const target = key
      ? document.getElementById(fieldId(key))
      : headingRef.current;
    if (!target) return;
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    target.focus({ preventScroll: true });
    target.scrollIntoView({
      block: "center",
      behavior: reduce ? "auto" : "smooth",
    });
  }, [step, showErrors, advancedOpen]);

  function revealErrors(target: { step: number; errors: StepErrors }) {
    const key = Object.keys(target.errors)[0] ?? null;
    if (key && ADVANCED_FIELDS.has(key)) setAdvancedOpen(true);
    pendingFocus.current = key;
    setStep(target.step);
    setShowErrors(true);
    // Si rien ne change (même étape, erreurs déjà visibles), on force le focus.
    if (
      target.step === step &&
      showErrors &&
      key &&
      (!ADVANCED_FIELDS.has(key) || advancedOpen)
    ) {
      pendingFocus.current = null;
      document.getElementById(fieldId(key))?.focus();
    }
  }

  function goTo(n: number) {
    if (n === step) return;
    setSubmitError(null);
    if (n < step) {
      setShowErrors(false);
      setStep(n);
      return;
    }
    const invalid = firstInvalidStep(s, step, n - 1);
    if (invalid) {
      revealErrors(invalid);
      return;
    }
    setShowErrors(false);
    setStep(n);
    setMaxReached((m) => Math.max(m, n));
  }

  /** Accueil proposé dans la langue de l'agent (français : celui du rôle ou du modèle). */
  const greetingCtx = { organizationName, template };

  function selectRole(role: AgentRole) {
    setS((prev) => followGreeting(prev, { role, tools: ROLE_META[role].defaultTools }, firstMsgDirty, greetingCtx));
  }

  /** Langue ou mode bilingue changés : l'accueil suit, tant qu'il n'a pas été réécrit à la main. */
  function changeLanguage(patch: Partial<Pick<WizardState, "language" | "bilingual">>) {
    setS((prev) => followGreeting(prev, patch, firstMsgDirty, greetingCtx));
  }

  // Nom de l'agent changé : l'accueil (qui le cite hors français) suit, tant qu'il n'est pas réécrit.
  useEffect(() => {
    if (!firstMsgDirty && s.role) setS((prev) => followGreeting(prev, {}, false, greetingCtx));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.name]);

  function toggleTool(name: string) {
    setS((prev) => ({
      ...prev,
      tools: prev.tools.includes(name)
        ? prev.tools.filter((t) => t !== name)
        : [...prev.tools, name],
    }));
  }

  function regeneratePrompt() {
    if (!s.role) return;
    setPromptDirty(false);
    set({
      systemPrompt: generateSystemPrompt(promptParams(s, organizationName)),
    });
  }

  async function submit(asDraft: boolean) {
    setSubmitError(null);
    // Un brouillon n'exige que l'identité ; une version finale, toutes les étapes.
    const invalid = asDraft
      ? firstInvalidStep(s, 1, 1)
      : firstInvalidStep(s, 1, LAST_STEP);
    if (invalid || !s.role) {
      if (invalid) revealErrors(invalid);
      return;
    }
    setSubmitting(asDraft ? "draft" : "final");
    const studio = studioVoices.find((v) => v.id === s.voiceId);
    const payload = buildPayload(
      { ...s, role: s.role },
      { asDraft, studio, greeting: greetingCtx },
    );
    try {
      const res = await fetch(
        isEdit ? `/api/agents/${agent!.id}` : "/api/agents",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSubmitError(data.error ?? "Une erreur est survenue.");
        setSubmitting(null);
        return;
      }
      // Création : on enchaîne sur le guide de mise en ligne.
      router.push(isEdit ? `/agents/${data.agent.id}` : `/agents/${data.agent.id}/launch`);
      router.refresh();
    } catch {
      setSubmitError(
        "Impossible de joindre le serveur. Vérifiez votre connexion.",
      );
      setSubmitting(null);
    }
  }

  const studio = studioVoices.find((v) => v.id === s.voiceId);
  const voiceLabel =
    studio?.name ?? "Aucune voix choisie";
  const modelLabel =
    MODELS[s.modelProvider]?.find((m) => m.id === s.modelId)?.label ??
    s.modelId;
  const current = STEPS[step - 1];
  const isLast = step === LAST_STEP;

  return (
    <div className="space-y-6">
      {!isEdit && (
      <div>
        <Link
          href={isEdit ? `/agents/${agent!.id}` : "/agents"}
          className="inline-flex items-center gap-1.5 rounded-sm text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/55"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {isEdit ? "Retour à l'agent" : "Retour aux agents"}
        </Link>
        <h1 className="mt-3 text-display-sm font-semibold tracking-tight">
          {isEdit ? `Configurer ${agent!.name}` : "Créer un agent"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {isEdit
            ? "Modifiez n'importe quelle étape puis enregistrez."
            : `${LAST_STEP} étapes, environ 3 minutes. Vous pourrez tout modifier ensuite.`}
        </p>
      </div>
      )}

      <Stepper step={step} maxReached={maxReached} onStepClick={goTo} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <div className="rounded-xl border border-border bg-card [&_[aria-invalid=true]]:border-destructive/70">
            <div className="p-5 sm:p-6">
              <StepShell
                ref={headingRef}
                step={step}
                total={LAST_STEP}
                title={current.title}
                description={STEP_DESCRIPTIONS[step]}
              >
                {step === 1 && (
                  <StepIdentity
                    s={s}
                    set={set}
                    errors={errors}
                    onSelectRole={selectRole}
                  />
                )}
                {step === 2 && (
                  <StepVoice
                    s={s}
                    set={set}
                    onLanguageChange={changeLanguage}
                    errors={errors}
                    studioVoices={studioVoices}
                  />
                )}
                {step === 3 && (
                  <StepConversation
                    s={s}
                    set={set}
                    errors={errors}
                    advancedOpen={advancedOpen}
                    onAdvancedOpenChange={setAdvancedOpen}
                    suggestedGreeting={suggestedGreeting(s, greetingCtx)}
                    onFirstMessageEdit={(v) => {
                      setFirstMsgDirty(true);
                      set({ firstMessage: v });
                    }}
                    onPromptEdit={(v) => {
                      setPromptDirty(true);
                      set({ systemPrompt: v });
                    }}
                    onRegeneratePrompt={regeneratePrompt}
                  />
                )}
                {step === 4 && (
                  <StepTools
                    s={s}
                    set={set}
                    errors={errors}
                    customTools={customToolsState}
                    knowledgeBases={knowledgeBases}
                    onToggleTool={toggleTool}
                    onToolCreated={(tool) => {
                      setCustomToolsState((list) => [tool, ...list]);
                      setS((prev) => ({
                        ...prev,
                        tools: prev.tools.includes(tool.name)
                          ? prev.tools
                          : [...prev.tools, tool.name],
                      }));
                    }}
                  />
                )}
                {step === 5 && (
                  <StepTelephony
                    s={s}
                    set={set}
                    agentId={agent?.id}
                    ownNumber={agent?.phoneNumber ?? null}
                    usedNumbers={usedNumbers}
                    availableNumbers={availableNumbers}
                  />
                )}
              </StepShell>
            </div>

            {/* Pied d'assistant collant */}
            <div className="sticky bottom-0 z-20 rounded-b-xl border-t border-border bg-card/95 px-5 py-3 backdrop-blur supports-[backdrop-filter]:bg-card/80 sm:px-6">
              {(submitError || hasErrors) && (
                <p
                  role="alert"
                  className="mb-3 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                >
                  <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
                  {submitError ??
                    "Corrigez les champs signalés pour continuer."}
                </p>
              )}
              <div className="flex items-center justify-between gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => goTo(step - 1)}
                  disabled={step === 1 || submitting !== null}
                >
                  <ArrowLeft className="size-4" aria-hidden />
                  <span className="hidden sm:inline">Précédent</span>
                  <span className="sr-only sm:hidden">Étape précédente</span>
                </Button>

                <div className="flex items-center gap-2">
                  {isEdit ? (
                    <>
                      {!isLast && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => goTo(step + 1)}
                          disabled={submitting !== null}
                        >
                          Suivant
                          <ArrowRight className="size-4" aria-hidden />
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="brand"
                        onClick={() => submit(false)}
                        disabled={submitting !== null}
                      >
                        {submitting ? (
                          <Loader2
                            className="size-4 animate-spin"
                            aria-hidden
                          />
                        ) : (
                          <Check className="size-4" aria-hidden />
                        )}
                        Enregistrer
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => submit(true)}
                        disabled={submitting !== null}
                        title="Sauvegarder l'état actuel sans mettre en ligne"
                      >
                        {submitting === "draft" ? (
                          <Loader2
                            className="size-4 animate-spin"
                            aria-hidden
                          />
                        ) : (
                          <FileText className="size-4" aria-hidden />
                        )}
                        <span className="hidden sm:inline">
                          Enregistrer le brouillon
                        </span>
                        <span className="sm:hidden">Brouillon</span>
                      </Button>
                      {isLast ? (
                        <Button
                          type="button"
                          variant="brand"
                          onClick={() => submit(false)}
                          disabled={submitting !== null}
                        >
                          {submitting === "final" ? (
                            <Loader2
                              className="size-4 animate-spin"
                              aria-hidden
                            />
                          ) : (
                            <Check className="size-4" aria-hidden />
                          )}
                          Créer l&apos;agent
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="brand"
                          onClick={() => goTo(step + 1)}
                          disabled={submitting !== null}
                        >
                          Suivant
                          <ArrowRight className="size-4" aria-hidden />
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <aside className="lg:col-span-2" aria-label="Aperçu en direct">
          <div className="lg:sticky lg:top-20">
            <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Aperçu en direct
            </p>
            <CallPreview
              name={s.name}
              role={s.role ?? "support"}
              roleLabel={
                s.role === "custom"
                  ? s.customRoleLabel || "Rôle personnalisé"
                  : undefined
              }
              firstMessage={s.firstMessage}
              firstSpeaker={s.firstSpeaker}
              voiceLabel={voiceLabel}
              language={s.language}
              modelLabel={modelLabel}
              temperature={s.temperature}
              toolsCount={s.tools.length}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}
