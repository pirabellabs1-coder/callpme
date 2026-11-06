"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search, ShoppingCart, PhoneCall } from "lucide-react";
import { NUMBER_COUNTRIES } from "@/lib/telephony/numbers";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Available {
  phoneNumber: string;
  locality: string | null;
  region: string | null;
}

const TYPE_LABEL = { local: "Fixe (géographique)", mobile: "Mobile", tollfree: "Gratuit pour l'appelant" } as const;

/** Achat d'un numéro relié d'office au moteur vocal. */
export function BuyNumber({
  available,
  isAdmin,
  remaining,
}: {
  /** Téléphonie de la plateforme configurée. */
  available: boolean;
  isAdmin: boolean;
  /** Numéros encore autorisés par l'offre. */
  remaining: number;
}) {
  const router = useRouter();
  const [country, setCountry] = useState("FR");
  const info = NUMBER_COUNTRIES.find((c) => c.code === country)!;
  const [type, setType] = useState<"local" | "mobile" | "tollfree">("local");
  const [contains, setContains] = useState("");
  const [results, setResults] = useState<Available[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    setBusy("search");
    setError(null);
    setNotice(null);
    const q = new URLSearchParams({ country, type, ...(contains.trim() ? { contains: contains.trim() } : {}) });
    const res = await fetch(`/api/numbers/available?${q}`);
    const body = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setResults(null);
      return setError(body?.error ?? "Recherche impossible.");
    }
    setResults(body.numbers);
  }

  async function buy(n: Available) {
    if (!window.confirm(`Acheter le ${n.phoneNumber} pour ${info.monthlyEur} € par mois ? Il sera facturé avec votre abonnement.`)) return;
    setBusy(n.phoneNumber);
    setError(null);
    const res = await fetch("/api/numbers/purchase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phoneNumber: n.phoneNumber, label: [info.label, n.locality].filter(Boolean).join(" · ") }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) return setError(body?.error ?? "Achat impossible.");
    setResults((r) => r?.filter((x) => x.phoneNumber !== n.phoneNumber) ?? null);
    setNotice(`${n.phoneNumber} est à vous. Reliez-le à un agent dans sa configuration (étape « Téléphonie »).`);
    router.refresh();
  }

  return (
    <Card className="p-5">
      <h2 className="flex items-center gap-2 text-[0.95rem] font-semibold tracking-tight">
        <ShoppingCart className="size-4 text-muted-foreground" aria-hidden /> Acheter un numéro
      </h2>
      <p className="mt-0.5 text-sm text-muted-foreground">
        Le numéro est prêt immédiatement : les appels qu&apos;il reçoit arrivent sur l&apos;agent auquel vous le reliez.
      </p>

      {!available ? (
        <p className="mt-3 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
          L&apos;achat de numéros sera disponible dès que la téléphonie de la plateforme (Twilio ou Telnyx) est configurée.
        </p>
      ) : !isAdmin ? (
        <p className="mt-3 text-sm text-muted-foreground">Seuls les administrateurs de l&apos;organisation peuvent acheter un numéro.</p>
      ) : remaining <= 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">Votre offre ne permet pas de numéro supplémentaire.</p>
      ) : (
        <>
          <form onSubmit={search} className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
            <div className="space-y-1.5">
              <Label htmlFor="bn-country">Pays</Label>
              <Select
                id="bn-country"
                value={country}
                onChange={(e) => {
                  setCountry(e.target.value);
                  setType("local");
                  setResults(null);
                }}
              >
                {NUMBER_COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label} — {c.monthlyEur} €/mois
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bn-type">Type</Label>
              <Select id="bn-type" value={type} onChange={(e) => setType(e.target.value as typeof type)}>
                {info.types.map((t) => (
                  <option key={t} value={t}>
                    {TYPE_LABEL[t]}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bn-contains">Contient (facultatif)</Label>
              <Input id="bn-contains" inputMode="numeric" value={contains} onChange={(e) => setContains(e.target.value)} placeholder="Ex. 184" maxLength={8} />
            </div>
            <Button type="submit" variant="outline" disabled={busy !== null}>
              {busy === "search" ? <Loader2 className="animate-spin" aria-hidden /> : <Search aria-hidden />}
              Chercher
            </Button>
          </form>

          <div aria-live="polite">
            {error && (
              <p role="alert" className="mt-3 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}
            {notice && <p className="mt-3 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">{notice}</p>}
            {results && results.length === 0 && <p className="mt-3 text-sm text-muted-foreground">Aucun numéro disponible pour ces critères.</p>}
            {results && results.length > 0 && (
              <ul className="mt-3 divide-y divide-border rounded-lg border border-border">
                {results.map((n) => (
                  <li key={n.phoneNumber} className="flex flex-wrap items-center gap-3 px-3 py-2">
                    <PhoneCall className="size-4 text-muted-foreground" aria-hidden />
                    <span className="mono text-sm">{n.phoneNumber}</span>
                    <span className="flex-1 truncate text-xs text-muted-foreground">{[n.locality, n.region].filter(Boolean).join(", ")}</span>
                    <Button type="button" size="sm" variant="secondary" onClick={() => buy(n)} disabled={busy !== null}>
                      {busy === n.phoneNumber ? <Loader2 className="animate-spin" aria-hidden /> : null}
                      Acheter · {info.monthlyEur} €/mois
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            En France, en Belgique et en Suisse, l&apos;opérateur peut exiger un justificatif d&apos;identité et d&apos;adresse :
            si l&apos;achat est refusé pour cette raison, contactez-nous.
          </p>
        </>
      )}
    </Card>
  );
}
