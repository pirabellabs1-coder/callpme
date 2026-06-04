"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { PLAN_ORDER, PLANS, type PlanId } from "@/lib/billing/plans";
import { switchPlan } from "@/app/actions/billing";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function PlanCards({ currentPlan }: { currentPlan: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [target, setTarget] = useState<PlanId | null>(null);

  function choose(id: PlanId) {
    if (id === currentPlan || pending) return;
    setTarget(id);
    startTransition(async () => {
      const res = await switchPlan(id);
      if (res.ok) router.refresh();
      setTarget(null);
    });
  }

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
      {PLAN_ORDER.map((id) => {
        const plan = PLANS[id];
        const isCurrent = currentPlan === id;
        return (
          <div
            key={id}
            className={cn(
              "relative flex flex-col rounded-2xl border bg-card p-6 shadow-sm",
              isCurrent
                ? "border-brand/50 ring-2 ring-brand/15"
                : plan.highlight
                  ? "border-border"
                  : "border-border",
            )}
          >
            {isCurrent && (
              <span className="absolute -top-3 left-6 inline-flex items-center rounded-full bg-brand px-3 py-1 text-xs font-semibold text-white shadow-brand">
                Offre actuelle
              </span>
            )}
            <h3 className="font-semibold tracking-tight text-foreground">
              {plan.name}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">{plan.tagline}</p>
            <div className="mt-4 flex items-baseline gap-1">
              <span className="text-display-sm font-semibold tracking-tight text-foreground">
                {plan.priceLabel}
              </span>
              <span className="text-sm text-muted-foreground">{plan.period}</span>
            </div>
            <ul className="mt-5 flex-1 space-y-2.5">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-2.5 text-sm">
                  <Check className="mt-0.5 size-4 shrink-0 text-brand" />
                  <span className="text-foreground/90">{f}</span>
                </li>
              ))}
            </ul>
            <Button
              variant={isCurrent ? "outline" : plan.highlight ? "brand" : "default"}
              className="mt-6 w-full"
              disabled={isCurrent || pending}
              onClick={() => choose(id)}
            >
              {target === id && <Loader2 className="size-4 animate-spin" />}
              {isCurrent ? "Offre actuelle" : `Passer à ${plan.name}`}
            </Button>
          </div>
        );
      })}
    </div>
  );
}
