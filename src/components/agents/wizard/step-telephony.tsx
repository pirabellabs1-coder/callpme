"use client";

import Link from "next/link";
import {
  CirclePause,
  FileText,
  PhoneCall,
  PlayCircle,
  Radio,
} from "lucide-react";
import type { PhoneNumberRecord } from "@/lib/shared/types";
import { ChoiceCard } from "./controls";
import { NumberPicker } from "./number-picker";
import type { SetWizardState, WizardState } from "./state";

const inputCls =
  "flex h-10 w-full rounded-lg border border-input bg-background/60 px-3 py-2 text-sm focus-visible:border-brand/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/15";

/** Rappel automatique des bips et des appels manqués. */
function CallbackFieldset({ s, set }: { s: WizardState; set: SetWizardState }) {
  const cb = s.callback;
  const patch = (p: Partial<WizardState["callback"]>) => set({ callback: { ...cb, ...p } });
  return (
    <fieldset className="space-y-3 rounded-xl border border-border p-4">
      <legend className="px-1 text-sm font-medium text-foreground">Rappel automatique des bips et appels manqués</legend>
      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          className="mt-0.5 size-4 accent-[hsl(var(--brand))]"
          checked={cb.enabled}
          onChange={(e) => patch({ enabled: e.target.checked })}
          aria-describedby="callback-help"
        />
        <span>
          <span className="font-medium text-foreground">Rappeler automatiquement</span>
          <span id="callback-help" className="mt-0.5 block text-xs text-muted-foreground">
            Quand quelqu&apos;un « bipe » ou raccroche avant d&apos;avoir parlé, l&apos;agent le rappelle en quelques
            secondes. Le rappel est un appel sortant, payé sur votre crédit d&apos;appels.
          </span>
        </span>
      </label>
      {cb.enabled && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Mode de rappel">
            {(
              [
                ["missed", "Décrocher, et rappeler les appels manqués", "L'agent répond à tous les appels ; il rappelle ceux qui ont raccroché trop tôt."],
                ["flash", "Mode bip : ne pas décrocher, rappeler aussitôt", "L'appelant ne paie rien : l'agent le rappelle à vos frais. Si le rappel est impossible, l'agent décroche."],
              ] as const
            ).map(([value, title, note]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={cb.mode === value}
                onClick={() => patch({ mode: value })}
                className={
                  "rounded-xl border p-3 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 " +
                  (cb.mode === value ? "border-brand/50 bg-brand/[0.06]" : "border-border hover:bg-foreground/[0.03]")
                }
              >
                <span className="block font-medium text-foreground">{title}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{note}</span>
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="callback-delay" className="text-xs text-muted-foreground">Délai avant le rappel</label>
              <select id="callback-delay" className={inputCls} value={cb.delaySec} onChange={(e) => patch({ delaySec: Number(e.target.value) })}>
                {[10, 30, 60, 120, 300].map((v) => (
                  <option key={v} value={v}>{v < 60 ? `${v} secondes` : `${v / 60} minute${v > 60 ? "s" : ""}`}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="callback-max" className="text-xs text-muted-foreground">Rappels au maximum par numéro (24 h)</label>
              <select id="callback-max" className={inputCls} value={cb.maxPerDay} onChange={(e) => patch({ maxPerDay: Number(e.target.value) })}>
                {[1, 2, 3, 5].map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="callback-message" className="text-xs text-muted-foreground">
              Première phrase du rappel <span className="font-normal">(facultatif — {"{agent}"} et {"{organisation}"} sont remplacés)</span>
            </label>
            <textarea
              id="callback-message"
              rows={2}
              maxLength={400}
              value={cb.message ?? ""}
              onChange={(e) => patch({ message: e.target.value })}
              placeholder="Bonjour, ici {agent} de {organisation}. Vous avez essayé de nous joindre il y a quelques instants, je vous rappelle. Comment puis-je vous aider ?"
              className="flex w-full rounded-lg border border-input bg-background/60 px-3 py-2 text-sm placeholder:text-muted-foreground/60 focus-visible:border-brand/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/15"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Jamais de rappel vers un numéro masqué, la liste d&apos;opposition ou un pays non couvert (France, Bénin,
            Côte d&apos;Ivoire). Sans crédit d&apos;appels suffisant, l&apos;agent ne rappelle pas.
          </p>
        </div>
      )}
    </fieldset>
  );
}

export function StepTelephony({
  s,
  set,
  agentId,
  ownNumber,
  usedNumbers,
  availableNumbers,
}: {
  s: WizardState;
  set: SetWizardState;
  agentId?: string;
  ownNumber: string | null;
  usedNumbers: string[];
  availableNumbers: PhoneNumberRecord[];
}) {
  return (
    <>
      <NumberPicker
        value={s.phoneNumber}
        ownNumber={ownNumber}
        usedNumbers={usedNumbers}
        numbers={availableNumbers}
        onChange={(n) => set({ phoneNumber: n })}
      />

      <div className="space-y-1.5">
        <label htmlFor="transfer-number" className="text-sm font-medium text-foreground">
          Numéro de transfert vers un humain{" "}
          <span className="font-normal text-muted-foreground">(facultatif)</span>
        </label>
        <input
          id="transfer-number"
          type="tel"
          inputMode="tel"
          autoComplete="off"
          placeholder="+33 1 23 45 67 89"
          value={s.transferNumber}
          onChange={(e) => set({ transferNumber: e.target.value })}
          aria-describedby="transfer-number-help"
          className="flex h-10 w-full rounded-lg border border-input bg-background/60 px-3 py-2 text-sm placeholder:text-muted-foreground/60 focus-visible:border-brand/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/15"
        />
        <p id="transfer-number-help" className="text-xs text-muted-foreground">
          Quand l&apos;appelant demande à parler à quelqu&apos;un, l&apos;agent transfère l&apos;appel vers ce numéro
          (format international). Activez aussi l&apos;outil « Transférer à un humain ».
        </p>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-foreground">Si un répondeur décroche (appels sortants)</legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Comportement face à un répondeur">
          {(
            [
              ["message", "Laisser un message", "Après le bip, avec la voix de l'agent"],
              ["hangup", "Raccrocher", "Sans laisser de message"],
              ["off", "Ne pas détecter", "L'agent parle dès le décroché"],
            ] as const
          ).map(([value, title, note]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={s.voicemailAction === value}
              onClick={() => set({ voicemailAction: value })}
              className={
                "rounded-xl border p-3 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 " +
                (s.voicemailAction === value ? "border-brand/50 bg-brand/[0.06]" : "border-border hover:bg-foreground/[0.03]")
              }
            >
              <span className="block font-medium text-foreground">{title}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{note}</span>
            </button>
          ))}
        </div>
        {s.voicemailAction === "message" && (
          <div className="space-y-1.5 pt-1">
            <label htmlFor="voicemail-message" className="text-xs text-muted-foreground">
              Message laissé <span className="font-normal">(facultatif — {"{agent}"} et {"{organisation}"} sont remplacés)</span>
            </label>
            <textarea
              id="voicemail-message"
              rows={3}
              maxLength={600}
              value={s.voicemailMessage}
              onChange={(e) => set({ voicemailMessage: e.target.value })}
              placeholder="Bonjour, ici {agent}, l'assistant de {organisation}. Nous avons essayé de vous joindre. Vous pouvez nous rappeler à ce numéro quand vous le souhaitez."
              className="flex w-full rounded-lg border border-input bg-background/60 px-3 py-2 text-sm placeholder:text-muted-foreground/60 focus-visible:border-brand/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/15"
            />
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          La détection ajoute 2 à 4 secondes avant que l&apos;agent parle quand un humain décroche.
        </p>
      </fieldset>

      <CallbackFieldset s={s} set={set} />

      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-medium text-foreground">
          État à l&apos;enregistrement
        </legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <ChoiceCard
            selected={s.status === "active"}
            onClick={() => set({ status: "active" })}
            icon={Radio}
            title="En ligne"
            note="Décroche les appels"
          />
          <ChoiceCard
            selected={s.status === "paused"}
            onClick={() => set({ status: "paused" })}
            icon={CirclePause}
            title="En pause"
            note="Configuré, inactif"
          />
          <ChoiceCard
            selected={s.status === "draft"}
            onClick={() => set({ status: "draft" })}
            icon={FileText}
            title="Brouillon"
            note="Non déployé"
          />
        </div>
        {s.status === "active" && !s.phoneNumber && (
          <p className="text-xs text-amber-700">
            Sans numéro, l&apos;agent ne pourra pas recevoir d&apos;appels
            téléphoniques (le test dans le navigateur reste possible).
          </p>
        )}
      </fieldset>

      <div className="flex items-start gap-3 rounded-lg border border-emerald-600/20 bg-emerald-50 p-3.5">
        <PhoneCall
          className="mt-0.5 size-4 shrink-0 text-emerald-700"
          aria-hidden
        />
        <p className="text-xs text-muted-foreground">
          {agentId ? (
            <>
              Vous pouvez{" "}
              <Link
                href={`/agents/${agentId}/test`}
                className="inline-flex items-center gap-1 font-medium text-brand-700 hover:underline"
              >
                <PlayCircle className="size-3.5" aria-hidden />
                tester cet agent en direct
              </Link>{" "}
              (micro du navigateur) à tout moment.
            </>
          ) : (
            <>
              Une fois créé, vous pourrez{" "}
              <strong className="text-foreground">
                tester l&apos;agent en direct
              </strong>{" "}
              dans le navigateur (micro) avant de le déployer sur un vrai
              numéro.
            </>
          )}
        </p>
      </div>
    </>
  );
}
