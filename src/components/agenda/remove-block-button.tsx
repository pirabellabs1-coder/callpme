"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { removeUnavailability } from "@/app/actions/agenda";

/** Retire une indisponibilité depuis la liste des rendez-vous. */
export function RemoveBlockButton({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const res = await removeUnavailability(id);
        setBusy(false);
        if (res.error) window.alert(res.error);
        router.refresh();
      }}
      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
    >
      {busy ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <Trash2 className="size-3.5" aria-hidden="true" />}
      Retirer
    </button>
  );
}
