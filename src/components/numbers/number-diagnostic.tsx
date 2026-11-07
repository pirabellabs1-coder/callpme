"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, MinusCircle, Stethoscope, XCircle } from "lucide-react";
import type { NumberDiagnostic, CheckStatus } from "@/lib/telephony/diagnostics";

const ICON: Record<CheckStatus, { Icon: typeof CheckCircle2; className: string; label: string }> = {
  ok: { Icon: CheckCircle2, className: "text-emerald-400", label: "Correct" },
  warn: { Icon: AlertTriangle, className: "text-amber-400", label: "À surveiller" },
  error: { Icon: XCircle, className: "text-rose-400", label: "À corriger" },
  skip: { Icon: MinusCircle, className: "text-muted-foreground", label: "Non vérifié" },
};

/** Bouton « Vérifier » d'un numéro et résultat du diagnostic, point par point. */
export function NumberDiagnosticButton({ numberId }: { numberId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [diag, setDiag] = useState<NumberDiagnostic | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setOpen(true);
    setLoading(true);
    setError(null);
    const res = await fetch(`/api/numbers/${numberId}/diagnostic`);
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) return setError(data.error ?? "Vérification impossible.");
    setDiag(data.diagnostic);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => (open && !loading ? setOpen(false) : run())}
        className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        aria-expanded={open}
        aria-controls={`diag-${numberId}`}
      >
        {loading ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Stethoscope className="size-4" aria-hidden="true" />}
        Vérifier
      </button>
      {open && (
        <div id={`diag-${numberId}`} className="order-last w-full rounded-xl border border-border bg-background/60 p-4" aria-live="polite">
          {loading && !diag ? (
            <p className="text-sm text-muted-foreground">Vérification en cours (Twilio, moteur vocal, crédit)…</p>
          ) : error ? (
            <p role="alert" className="text-sm text-rose-300">
              {error}
            </p>
          ) : diag ? (
            <>
              <div className="mb-3 flex flex-wrap gap-2 text-sm">
                <Summary ok={diag.inboundReady} label="Appels entrants" />
                <Summary ok={diag.outboundReady} label="Appels sortants" />
              </div>
              <ul className="space-y-2.5">
                {diag.checks.map((c) => {
                  const { Icon, className, label } = ICON[c.status];
                  return (
                    <li key={c.id} className="flex gap-2.5 text-sm">
                      <Icon className={`mt-0.5 size-4 shrink-0 ${className}`} aria-label={label} />
                      <div className="min-w-0">
                        <p className="font-medium">{c.label}</p>
                        <p className="text-muted-foreground">{c.detail}</p>
                        {c.fix && <p className="mt-0.5 text-foreground/80">→ {c.fix}</p>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          ) : null}
        </div>
      )}
    </>
  );
}

function Summary({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
        ok ? "bg-emerald-500/10 text-emerald-300" : "bg-rose-500/10 text-rose-300"
      }`}
    >
      {ok ? <CheckCircle2 className="size-3.5" aria-hidden="true" /> : <XCircle className="size-3.5" aria-hidden="true" />}
      {label} : {ok ? "prêts" : "bloqués"}
    </span>
  );
}
