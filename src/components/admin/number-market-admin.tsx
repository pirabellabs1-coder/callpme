"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  MARKET_COUNTRIES,
  NUMBER_KINDS,
  REQUEST_STATUS_LABEL,
  formatMarketNumber,
  formatXof,
  marketCountry,
  networkLabel,
  matchesPrefix,
} from "@/lib/numbers/market";
import {
  approveRequestAction,
  deleteStockAction,
  importStockAction,
  rejectRequestAction,
  releaseStockAction,
  toggleStockAction,
} from "@/app/actions/admin-number-market";

interface PendingRow {
  id: string;
  org: string;
  plan: string;
  country: string;
  network: string | null;
  desiredPrefix: string | null;
  stockId: string | null;
  stockNumber: string | null;
  companyName: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  businessId: string | null;
  taxId: string | null;
  address: string;
  usage: string | null;
  createdAt: string;
}

interface ProcessedRow {
  id: string;
  org: string;
  country: string;
  status: string;
  assignedNumber: string | null;
  adminNote: string | null;
  updatedAt: string;
}

interface StockRow {
  id: string;
  number: string;
  country: string;
  network: string;
  kind: string;
  monthlyPriceXof: number;
  setupPriceXof: number;
  status: string;
  note: string | null;
}

interface AvailableRow {
  id: string;
  number: string;
  country: string;
  network: string;
  monthlyPriceXof: number;
}

const STOCK_STATUS: Record<string, { label: string; variant: "success" | "warning" | "brand" | "muted" }> = {
  available: { label: "Disponible", variant: "success" },
  reserved: { label: "Réservé", variant: "warning" },
  assigned: { label: "Attribué", variant: "brand" },
  disabled: { label: "En pause", variant: "muted" },
};

export function NumberMarketAdmin({
  counts,
  filters,
  pending,
  processed,
  stock,
  available,
}: {
  counts: Record<string, number>;
  filters: { country: string; status: string };
  pending: PendingRow[];
  processed: ProcessedRow[];
  stock: StockRow[];
  available: AvailableRow[];
}) {
  const [tab, setTab] = useState<"requests" | "stock">(pending.length > 0 ? "requests" : "stock");
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2 text-sm">
        {Object.entries(STOCK_STATUS).map(([k, v]) => (
          <Badge key={k} variant={v.variant}>
            {v.label} : {counts[k] ?? 0}
          </Badge>
        ))}
      </div>
      <div role="tablist" aria-label="Sections" className="flex gap-1 border-b border-border">
        {(
          [
            ["requests", `Demandes (${pending.length})`],
            ["stock", "Stock"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm transition-colors ${
              tab === id ? "border-brand font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "requests" ? (
        <Requests pending={pending} processed={processed} available={available} />
      ) : (
        <Stock stock={stock} filters={filters} />
      )}
    </div>
  );
}

/* -------------------------------- Demandes -------------------------------- */

function Requests({ pending, processed, available }: { pending: PendingRow[]; processed: ProcessedRow[]; available: AvailableRow[] }) {
  return (
    <div className="space-y-6">
      {pending.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune demande en attente.</p>
      ) : (
        <ul className="space-y-3">
          {pending.map((r) => (
            <RequestCard key={r.id} r={r} available={available} />
          ))}
        </ul>
      )}
      {processed.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold">Dernières demandes traitées</h2>
          <ul className="divide-y divide-border rounded-xl border border-border text-sm">
            {processed.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                <Badge variant={p.status === "approved" ? "success" : p.status === "rejected" ? "danger" : "muted"}>
                  {REQUEST_STATUS_LABEL[p.status] ?? p.status}
                </Badge>
                <span className="flex-1">
                  {p.org} · {marketCountry(p.country)?.label}
                  {p.assignedNumber && <span className="mono"> · {formatMarketNumber(p.assignedNumber, p.country)}</span>}
                  {p.adminNote && <span className="text-muted-foreground"> · {p.adminNote}</span>}
                </span>
                <span className="text-muted-foreground">{new Date(p.updatedAt).toLocaleDateString("fr-FR")}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function RequestCard({ r, available }: { r: PendingRow; available: AvailableRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const candidates = useMemo(
    () =>
      available.filter(
        (a) =>
          a.country === r.country &&
          (!r.network || a.network === r.network) &&
          matchesPrefix(a.number, a.country, r.desiredPrefix ?? ""),
      ),
    [available, r],
  );
  const others = useMemo(
    () => available.filter((a) => a.country === r.country && !candidates.some((c) => c.id === a.id)),
    [available, r, candidates],
  );
  const [stockId, setStockId] = useState<string>(r.stockId ?? candidates[0]?.id ?? "");

  async function approve() {
    const chosen = r.stockId ?? stockId;
    if (!chosen) return setError("Choisissez un numéro du stock.");
    const label = r.stockNumber ?? available.find((a) => a.id === chosen)?.number ?? "";
    if (!window.confirm(`Attribuer ${label} à ${r.org} ? Le numéro sera actif tout de suite chez le client.`)) return;
    setBusy(true);
    setError(null);
    const res = await approveRequestAction(r.id, r.stockId ? null : chosen, note);
    setBusy(false);
    if (res.error) return setError(res.error);
    router.refresh();
  }

  async function reject() {
    if (!note.trim() && !window.confirm("Refuser sans message pour le client ?")) return;
    if (note.trim() && !window.confirm("Refuser cette demande ?")) return;
    setBusy(true);
    setError(null);
    const res = await rejectRequestAction(r.id, note);
    setBusy(false);
    if (res.error) return setError(res.error);
    router.refresh();
  }

  return (
    <li className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-medium">
          {r.org} <span className="text-sm font-normal text-muted-foreground">· offre {r.plan}</span>
        </p>
        <span className="text-xs text-muted-foreground">reçue le {new Date(r.createdAt).toLocaleString("fr-FR")}</span>
      </div>
      <p className="mt-1 text-sm">
        {r.stockNumber ? (
          <>
            Numéro choisi : <span className="mono font-medium">{formatMarketNumber(r.stockNumber, r.country)}</span> (réservé)
          </>
        ) : (
          <>
            Demande libre : {marketCountry(r.country)?.label} · {networkLabel(r.country, r.network)}
            {r.desiredPrefix ? ` · commence par ${r.desiredPrefix}` : ""}
          </>
        )}
      </p>
      <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
        <Item k="Entreprise" v={r.companyName} />
        <Item k="Responsable" v={r.contactName} />
        <Item k="Téléphone" v={r.contactPhone} />
        <Item k="E-mail" v={r.contactEmail} />
        <Item k="RCCM" v={r.businessId ?? "—"} />
        <Item k="IFU" v={r.taxId ?? "—"} />
        <Item k="Adresse" v={r.address} />
        {r.usage && <Item k="Utilisation" v={r.usage} />}
      </dl>

      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        {!r.stockId ? (
          <div className="space-y-1.5">
            <Label htmlFor={`pick-${r.id}`}>Numéro à attribuer</Label>
            <Select id={`pick-${r.id}`} value={stockId} onChange={(e) => setStockId(e.target.value)}>
              <option value="">— Choisir dans le stock —</option>
              {candidates.length > 0 && (
                <optgroup label="Correspondent à la demande">
                  {candidates.map((a) => (
                    <option key={a.id} value={a.id}>
                      {formatMarketNumber(a.number, a.country)} · {networkLabel(a.country, a.network)} · {formatXof(a.monthlyPriceXof)}
                    </option>
                  ))}
                </optgroup>
              )}
              {others.length > 0 && (
                <optgroup label="Autres numéros du pays">
                  {others.map((a) => (
                    <option key={a.id} value={a.id}>
                      {formatMarketNumber(a.number, a.country)} · {networkLabel(a.country, a.network)} · {formatXof(a.monthlyPriceXof)}
                    </option>
                  ))}
                </optgroup>
              )}
            </Select>
            {candidates.length + others.length === 0 && (
              <p className="text-xs text-amber-300">Aucun numéro en stock pour ce pays : ajoutez-en dans l&apos;onglet Stock.</p>
            )}
          </div>
        ) : (
          <div />
        )}
        <div className="space-y-1.5">
          <Label htmlFor={`note-${r.id}`}>Message au client (facultatif)</Label>
          <Input id={`note-${r.id}`} value={note} maxLength={400} onChange={(e) => setNote(e.target.value)} />
        </div>
        <div className="flex gap-2">
          <Button variant="brand" size="sm" disabled={busy} onClick={approve}>
            {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
            Attribuer
          </Button>
          <Button variant="ghost" size="sm" disabled={busy} onClick={reject}>
            Refuser
          </Button>
        </div>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm text-rose-300">
          {error}
        </p>
      )}
    </li>
  );
}

function Item({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-2">
      <dt className="w-24 shrink-0 text-muted-foreground">{k}</dt>
      <dd className="min-w-0 break-words">{v}</dd>
    </div>
  );
}

/* ---------------------------------- Stock --------------------------------- */

function Stock({ stock, filters }: { stock: StockRow[]; filters: { country: string; status: string } }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function run(id: string, fn: () => Promise<{ error?: string }>) {
    setBusy(id);
    const res = await fn();
    setBusy(null);
    if (res.error) window.alert(res.error);
    router.refresh();
  }

  function setFilter(key: "pays" | "statut", value: string) {
    const q = new URLSearchParams();
    const next = { pays: filters.country, statut: filters.status, [key]: value };
    if (next.pays) q.set("pays", next.pays);
    if (next.statut) q.set("statut", next.statut);
    router.push(`/admin/marketplace-numeros${q.size ? `?${q}` : ""}`);
  }

  return (
    <div className="space-y-6">
      <ImportForm />

      <section className="space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <h2 className="mr-auto text-sm font-semibold">Numéros en stock ({stock.length})</h2>
          <div className="w-44">
            <Label htmlFor="f-country" className="sr-only">
              Pays
            </Label>
            <Select id="f-country" value={filters.country} onChange={(e) => setFilter("pays", e.target.value)}>
              <option value="">Tous les pays</option>
              {MARKET_COUNTRIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="w-40">
            <Label htmlFor="f-status" className="sr-only">
              Statut
            </Label>
            <Select id="f-status" value={filters.status} onChange={(e) => setFilter("statut", e.target.value)}>
              <option value="">Tous les statuts</option>
              {Object.entries(STOCK_STATUS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </Select>
          </div>
        </div>
        {stock.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun numéro pour ces filtres.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-secondary/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Numéro</th>
                  <th className="px-3 py-2 font-medium">Pays</th>
                  <th className="px-3 py-2 font-medium">Réseau</th>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 font-medium">Prix / mois</th>
                  <th className="px-3 py-2 font-medium">Statut</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {stock.map((s) => {
                  const st = STOCK_STATUS[s.status] ?? { label: s.status, variant: "muted" as const };
                  return (
                    <tr key={s.id}>
                      <td className="mono whitespace-nowrap px-3 py-2">{formatMarketNumber(s.number, s.country)}</td>
                      <td className="px-3 py-2">{marketCountry(s.country)?.label ?? s.country}</td>
                      <td className="px-3 py-2">{networkLabel(s.country, s.network)}</td>
                      <td className="px-3 py-2">{s.kind === "fixe" ? "Fixe" : "Mobile"}</td>
                      <td className="whitespace-nowrap px-3 py-2">{formatXof(s.monthlyPriceXof)}</td>
                      <td className="px-3 py-2">
                        <Badge variant={st.variant}>{st.label}</Badge>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right">
                        {s.status === "reserved" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={busy === s.id}
                            onClick={() => {
                              if (window.confirm(`Libérer ${s.number} ? Possible seulement si sa demande n'est plus en attente.`))
                                void run(s.id, () => releaseStockAction(s.id));
                            }}
                          >
                            Libérer
                          </Button>
                        )}
                        {(s.status === "available" || s.status === "disabled") && (
                          <div className="flex justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={busy === s.id}
                              onClick={() => run(s.id, () => toggleStockAction(s.id, s.status === "disabled"))}
                            >
                              {s.status === "disabled" ? "Remettre en vente" : "Mettre en pause"}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={busy === s.id}
                              onClick={() => {
                                if (window.confirm(`Supprimer ${s.number} du stock ?`)) void run(s.id, () => deleteStockAction(s.id));
                              }}
                            >
                              Supprimer
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function ImportForm() {
  const router = useRouter();
  const [country, setCountry] = useState("BJ");
  const [network, setNetwork] = useState("mtn");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const c = marketCountry(country);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    setBusy(true);
    setMessage(null);
    const res = await importStockAction({
      country,
      network,
      kind: String(f.get("kind")),
      monthlyPriceXof: Number(f.get("monthlyPriceXof") || 0),
      setupPriceXof: Number(f.get("setupPriceXof") || 0),
      numbers: String(f.get("numbers") || ""),
      note: String(f.get("note") || "") || undefined,
    });
    setBusy(false);
    setMessage({ ok: !res.error, text: res.error ?? res.info ?? "Fait." });
    if (res.ok) {
      (form.elements.namedItem("numbers") as HTMLTextAreaElement).value = "";
      router.refresh();
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border border-border bg-card p-4">
      <h2 className="text-sm font-semibold">Ajouter des numéros au stock</h2>
      <div className="grid gap-3 sm:grid-cols-5">
        <div className="space-y-1.5">
          <Label htmlFor="im-country">Pays</Label>
          <Select
            id="im-country"
            value={country}
            onChange={(e) => {
              setCountry(e.target.value);
              setNetwork(marketCountry(e.target.value)?.networks[0]?.id ?? "");
            }}
          >
            {MARKET_COUNTRIES.map((x) => (
              <option key={x.code} value={x.code}>
                {x.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="im-network">Réseau</Label>
          <Select id="im-network" value={network} onChange={(e) => setNetwork(e.target.value)}>
            {c?.networks.map((x) => (
              <option key={x.id} value={x.id}>
                {x.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="im-kind">Type</Label>
          <Select id="im-kind" name="kind" defaultValue="mobile">
            {NUMBER_KINDS.map((x) => (
              <option key={x.id} value={x.id}>
                {x.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="im-price">Prix mensuel (FCFA)</Label>
          <Input id="im-price" name="monthlyPriceXof" type="number" min={0} step={100} required defaultValue={3000} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="im-setup">Mise en service (FCFA)</Label>
          <Input id="im-setup" name="setupPriceXof" type="number" min={0} step={100} defaultValue={0} />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="im-numbers">Numéros (un par ligne, avec ou sans +{c?.dial})</Label>
        <Textarea id="im-numbers" name="numbers" rows={4} required placeholder={`0195123456\n+${c?.dial} 01 66 00 11 22`} className="mono" />
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[12rem] flex-1 space-y-1.5">
          <Label htmlFor="im-note">Note interne (facultatif)</Label>
          <Input id="im-note" name="note" maxLength={200} placeholder="ex. lot MTN de novembre" />
        </div>
        <Button type="submit" variant="brand" disabled={busy}>
          {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
          Ajouter au stock
        </Button>
      </div>
      {message && (
        <p role="status" className={`text-sm ${message.ok ? "text-emerald-300" : "text-rose-300"}`}>
          {message.text}
        </p>
      )}
    </form>
  );
}
