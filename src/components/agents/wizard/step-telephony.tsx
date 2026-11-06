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
