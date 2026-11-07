"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { syncGoogleCalendar } from "@/app/actions/agenda-sync";

/** Renvoie vers Google Agenda les rendez-vous qui n'y sont pas encore. */
export function SyncGoogleButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function run() {
    setBusy(true);
    setMsg(null);
    const res = await syncGoogleCalendar();
    setBusy(false);
    setMsg({ ok: !res.error, text: res.error ?? res.info ?? "Fait." });
    router.refresh();
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Button size="sm" variant="secondary" onClick={run} disabled={busy}>
        {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <RefreshCcw className="size-4" aria-hidden="true" />}
        Synchroniser avec Google Agenda
      </Button>
      {msg && (
        <span role="status" className={`text-sm ${msg.ok ? "text-emerald-300" : "text-rose-300"}`}>
          {msg.text}
        </span>
      )}
    </span>
  );
}
