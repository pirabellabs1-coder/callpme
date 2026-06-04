"use client";

import { useState } from "react";
import { Check, Loader2, Plug } from "lucide-react";
import { INTEGRATION_CATALOG } from "@/lib/integrations/catalog";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DynamicIcon } from "@/components/icon";

export function IntegrationsManager({ connected }: { connected: string[] }) {
  const [active, setActive] = useState<string[]>(connected);
  const [busy, setBusy] = useState<string | null>(null);

  async function toggle(id: string) {
    setBusy(id);
    const isOn = active.includes(id);
    const res = await fetch(
      isOn ? `/api/integrations/${id}` : "/api/integrations",
      isOn
        ? { method: "DELETE" }
        : {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ provider: id }),
          },
    );
    if (res.ok) {
      setActive((a) => (isOn ? a.filter((x) => x !== id) : [...a, id]));
    }
    setBusy(null);
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {INTEGRATION_CATALOG.map((integ) => {
        const on = active.includes(integ.id);
        return (
          <Card key={integ.id} className="flex flex-col p-5">
            <div className="flex items-start justify-between">
              <span className="inline-flex size-11 items-center justify-center rounded-xl bg-secondary text-foreground/60 ring-1 ring-inset ring-border [&_svg]:size-5">
                <DynamicIcon name={integ.icon} />
              </span>
              {on ? (
                <Badge variant="success">Connectée</Badge>
              ) : (
                <Badge variant="muted">{integ.category}</Badge>
              )}
            </div>
            <h3 className="mt-3 font-semibold tracking-tight text-foreground">
              {integ.name}
            </h3>
            <p className="mt-1 flex-1 text-sm text-muted-foreground text-pretty">
              {integ.description}
            </p>
            <Button
              variant={on ? "outline" : "default"}
              size="sm"
              className="mt-4"
              onClick={() => toggle(integ.id)}
              disabled={busy === integ.id}
            >
              {busy === integ.id ? (
                <Loader2 className="size-4 animate-spin" />
              ) : on ? (
                <Check className="size-4" />
              ) : (
                <Plug className="size-4" />
              )}
              {on ? "Déconnecter" : "Connecter"}
            </Button>
          </Card>
        );
      })}
    </div>
  );
}
