"use client";

import { useEffect, useId, useState } from "react";
import { Ban, Loader2, Plus, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface Row {
  phone: string;
  reason: string | null;
  createdAt: string;
}

/** Liste d'opposition : numéros jamais appelés, quelle que soit la campagne. */
export function OptOutList() {
  const ids = useId();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [total, setTotal] = useState(0);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  async function load() {
    const res = await fetch("/api/do-not-call");
    if (!res.ok) return setRows([]);
    const data = await res.json();
    setRows(data.numbers);
    setTotal(data.total);
  }
  useEffect(() => {
    void load();
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const phones = input
      .split(/[\n,;]+/)
      .map((p) => p.trim())
      .filter(Boolean);
    if (!phones.length) return;
    setBusy(true);
    setMessage(null);
    const res = await fetch("/api/do-not-call", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phones }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setMessage(data?.error ?? "Ajout impossible.");
    setInput("");
    setMessage(`${data.added} numéro(s) ajouté(s)${data.invalid ? `, ${data.invalid} invalide(s) ignoré(s)` : ""}.`);
    void load();
  }

  async function remove(phone: string) {
    if (!window.confirm(`Retirer ${phone} de la liste d'opposition ? Ne le faites que sur demande expresse de la personne.`)) return;
    await fetch(`/api/do-not-call?phone=${encodeURIComponent(phone)}`, { method: "DELETE" });
    void load();
  }

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-[0.95rem] font-semibold tracking-tight">
            <Ban className="size-4 text-muted-foreground" aria-hidden /> Liste d&apos;opposition
          </h2>
          <p className="mt-0.5 max-w-2xl text-sm text-muted-foreground text-pretty">
            Ces numéros ne sont jamais appelés, dans aucune campagne. Ceux qui disent « ne m&apos;appelez plus » pendant un
            appel y sont ajoutés automatiquement (outil « Ne plus appeler »). Vous pouvez aussi y coller votre liste Bloctel.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          {open ? "Fermer" : `Gérer${rows ? ` (${total})` : ""}`}
        </Button>
      </div>

      {open && (
        <div className="mt-4 grid gap-5 lg:grid-cols-2">
          <form onSubmit={add} className="space-y-2">
            <label htmlFor={`${ids}-in`} className="text-sm font-medium">
              Ajouter des numéros
            </label>
            <Textarea
              id={`${ids}-in`}
              rows={5}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={"+33 6 12 34 56 78\n+221 77 123 45 67"}
              className="font-mono text-xs"
            />
            <div className="flex items-center gap-3">
              <Button type="submit" size="sm" variant="secondary" disabled={busy || !input.trim()}>
                {busy ? <Loader2 className="animate-spin" aria-hidden /> : <Plus aria-hidden />}
                Ajouter
              </Button>
              <span aria-live="polite" className="text-xs text-muted-foreground">
                {message}
              </span>
            </div>
          </form>
          <div>
            <p className="text-sm font-medium">{total} numéro{total > 1 ? "s" : ""}</p>
            {rows && rows.length > 0 ? (
              <ul className="mt-2 max-h-56 divide-y divide-border overflow-auto rounded-lg border border-border text-sm">
                {rows.map((r) => (
                  <li key={r.phone} className="flex items-center justify-between gap-3 px-3 py-1.5">
                    <span className="mono">{r.phone}</span>
                    <span className="flex-1 truncate text-xs text-muted-foreground">{r.reason}</span>
                    <button
                      type="button"
                      onClick={() => remove(r.phone)}
                      aria-label={`Retirer ${r.phone}`}
                      className="rounded p-1 text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
                    >
                      <X className="size-3.5" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">Aucun numéro pour l&apos;instant.</p>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
