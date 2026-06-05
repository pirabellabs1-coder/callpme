"use client";

import { useState, useTransition } from "react";
import { Loader2, Building2, Mail, Send, Ban, CheckCircle2 } from "lucide-react";
import { quoteAgencyRequest, rejectAgencyRequest } from "@/app/actions/admin";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface Req {
  id: string;
  org: string;
  contactName: string;
  contactEmail: string;
  objectives: string;
  budgetEur: number;
  status: string;
  quotedAmountEur: number | null;
  createdAt: string;
}

const STATUS: Record<string, { label: string; variant: "muted" | "brand" | "success" | "danger" }> = {
  pending: { label: "À traiter", variant: "brand" },
  quoted: { label: "Devisé — en attente paiement", variant: "muted" },
  paid: { label: "Payé", variant: "success" },
  rejected: { label: "Refusée", variant: "danger" },
};

export function AgencyRequestsAdmin({ requests }: { requests: Req[] }) {
  if (requests.length === 0) {
    return (
      <Card className="p-8 text-center text-sm text-muted-foreground">
        Aucune demande d'offre Agence pour le moment.
      </Card>
    );
  }
  return (
    <div className="space-y-4">
      {requests.map((r) => (
        <RequestCard key={r.id} r={r} />
      ))}
    </div>
  );
}

function RequestCard({ r }: { r: Req }) {
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<"quote" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const st = STATUS[r.status] ?? STATUS.pending;

  function quote(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy("quote");
    const fd = new FormData(e.currentTarget);
    fd.set("id", r.id);
    start(async () => {
      const res = await quoteAgencyRequest(fd);
      if (res.error) setError(res.error);
      setBusy(null);
    });
  }

  function reject() {
    setBusy("reject");
    start(async () => {
      await rejectAgencyRequest(r.id);
      setBusy(null);
    });
  }

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-2 font-semibold tracking-tight text-foreground">
            <Building2 className="size-4 text-muted-foreground" />
            {r.org}
          </p>
          <p className="mt-0.5 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            <Mail className="size-3.5" />
            {r.contactName} · {r.contactEmail}
          </p>
        </div>
        <div className="text-right">
          <Badge variant={st.variant}>{st.label}</Badge>
          <p className="mt-1 text-xs text-muted-foreground">
            Budget annoncé : <span className="font-semibold text-foreground">{r.budgetEur} €</span>
            {r.quotedAmountEur != null && ` · Devis : ${r.quotedAmountEur} €`}
          </p>
        </div>
      </div>

      <p className="mt-3 whitespace-pre-wrap rounded-lg border border-border bg-secondary/30 p-3 text-sm text-foreground/90">
        {r.objectives}
      </p>

      {r.status === "pending" && (
        <form onSubmit={quote} className="mt-4 space-y-3 border-t border-border pt-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[160px_1fr]">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Montant à payer (€)</label>
              <Input name="amount" type="number" min={1} placeholder="Ex : 490" required />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Message au client (optionnel)</label>
              <Textarea name="note" rows={2} placeholder="Ce que comprend l'offre, conditions…" />
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" variant="brand" size="sm" disabled={pending}>
              {busy === "quote" ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              Valider & envoyer le montant
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={pending} onClick={reject}>
              {busy === "reject" ? <Loader2 className="size-4 animate-spin" /> : <Ban className="size-4" />}
              Refuser
            </Button>
          </div>
        </form>
      )}

      {r.status === "quoted" && (
        <p className="mt-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
          <CheckCircle2 className="size-4 text-brand" />
          Devis de <strong className="text-foreground">{r.quotedAmountEur} €</strong> envoyé — en attente du paiement du client.
        </p>
      )}
      {r.status === "paid" && (
        <p className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600">
          <CheckCircle2 className="size-4" />
          Payé — offre Agence active.
        </p>
      )}
    </Card>
  );
}
