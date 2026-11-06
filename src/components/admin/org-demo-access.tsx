"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { setDemoAccess } from "@/app/actions/admin";
import { DEMO_DAYS } from "@/lib/billing/subscription";

const fmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" });

/** État d'accès d'une organisation et accès démo accordé par l'équipe. */
export function OrgDemoAccess({ orgId, paidUntil, trialEndsAt }: { orgId: string; paidUntil: string | null; trialEndsAt: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const now = Date.now();
  const paid = paidUntil && new Date(paidUntil).getTime() > now;
  const demo = !paid && trialEndsAt && new Date(trialEndsAt).getTime() > now;

  function run(days: number) {
    setError(null);
    start(async () => {
      const r = await setDemoAccess(orgId, days);
      if (r.error) setError(r.error);
      else router.refresh();
    });
  }

  return (
    <span className="flex flex-col gap-0.5 text-xs">
      <span className={paid ? "text-success" : demo ? "text-brand" : "text-muted-foreground"}>
        {paid ? `Payé jusqu'au ${fmt.format(new Date(paidUntil!))}` : demo ? `Démo jusqu'au ${fmt.format(new Date(trialEndsAt!))}` : "Aucune offre"}
      </span>
      {!paid && (
        <button
          type="button"
          disabled={pending}
          onClick={() => run(demo ? 0 : DEMO_DAYS)}
          className="inline-flex w-fit items-center gap-1 text-brand-700 hover:underline disabled:opacity-50"
        >
          {pending && <Loader2 className="size-3 animate-spin" aria-hidden />}
          {demo ? "Retirer la démo" : `Accorder ${DEMO_DAYS} jours de démo`}
        </button>
      )}
      {error && <span role="alert" className="text-destructive">{error}</span>}
    </span>
  );
}
