"use client";

import { useState, useTransition } from "react";
import { Loader2, Check } from "lucide-react";
import { setOrgPlan } from "@/app/actions/admin";
import { Select } from "@/components/ui/select";

export function OrgPlanSelect({ orgId, plan }: { orgId: string; plan: string }) {
  const [value, setValue] = useState(plan);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  function change(p: string) {
    setValue(p);
    setSaved(false);
    start(async () => {
      const res = await setOrgPlan(orgId, p);
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    });
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <Select
        value={value}
        onChange={(e) => change(e.target.value)}
        className="h-8 w-28 text-xs"
        aria-label="Offre de l'organisation"
      >
        <option value="starter">Starter</option>
        <option value="pro">Pro</option>
        <option value="agency">Agence</option>
      </Select>
      {pending ? (
        <Loader2 className="size-3.5 animate-spin text-muted-foreground" />
      ) : saved ? (
        <Check className="size-3.5 text-emerald-600" />
      ) : null}
    </span>
  );
}
