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
