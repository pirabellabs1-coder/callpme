"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { reviewPhoneNumber } from "@/app/actions/admin";

export function NumberReviewActions({ id, number }: { id: string; number: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function act(action: "activate" | "reject") {
    if (action === "reject" && !window.confirm(`Refuser et supprimer ${number} ?`)) return;
    setBusy(true);
    const res = await reviewPhoneNumber(id, action);
    setBusy(false);
    if (res.ok) router.refresh();
    else window.alert(res.error ?? "Action impossible.");
  }
  return (
    <div className="flex gap-2">
      <Button size="sm" variant="secondary" disabled={busy} onClick={() => act("activate")}>
        Activer
      </Button>
      <Button size="sm" variant="ghost" disabled={busy} onClick={() => act("reject")}>
        Refuser
      </Button>
    </div>
  );
}
