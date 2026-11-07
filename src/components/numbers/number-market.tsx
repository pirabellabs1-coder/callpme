"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Phone, Search, X } from "lucide-react";
import { Card } from "@/components/ui/card";
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
  cleanPrefix,
  formatMarketNumber,
  formatXof,
  marketCountry,
  networkLabel,
} from "@/lib/numbers/market";
import { searchNumberOffers, requestNumber, cancelMyNumberRequest } from "@/app/actions/number-market";
import type { StockOffer } from "@/lib/numbers/market-db";

interface RequestRow {
  id: string;
  country: string;
  network: string | null;
  desiredPrefix: string | null;
  status: string;
  adminNote: string | null;
  assignedNumber: string | null;
  createdAt: string;
  stockId: string | null;
}

const STATUS_VARIANT: Record<string, "warning" | "success" | "danger" | "muted"> = {
  pending: "warning",
  approved: "success",
  rejected: "danger",
  cancelled: "muted",
};

export function NumberMarket({
  availability,
  defaultCountry,
  canRequest,
  defaultContact,
  requests,
}: {
  availability: Record<string, number>;
  defaultCountry: string;
  canRequest: boolean;
  defaultContact: { companyName: string; contactName: string; contactEmail: string };
  requests: RequestRow[];
}) {
  const router = useRouter();
  const [country, setCountry] = useState(defaultCountry);
  const [network, setNetwork] = useState("");
  const [kind, setKind] = useState("");
  const [prefix, setPrefix] = useState("");
  const [offers, setOffers] = useState<StockOffer[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  /** Numéro choisi, ou "free" pour une demande sans numéro précis. */
  const [selected, setSelected] = useState<StockOffer | "free" | null>(null);
  const [done, setDone] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);

  const c = marketCountry(country);
  const inStock = availability[country] ?? 0;

  async function search() {
    setLoading(true);
    setSearchError(null);
    const res = await searchNumberOffers({ country, network: network || undefined, kind: kind || undefined, prefix });
    setLoading(false);
    if (res.error) return setSearchError(res.error);
    setOffers(res.offers ?? []);
  }

  // Recherche automatique quand le pays, le réseau ou le type changent.
  useEffect(() => {
    setSelected(null);
    void search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [country, network, kind]);

  useEffect(() => {
    if (selected) formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [selected]);

  return (
    <div className="space-y-6">
      {done && (
        <p role="status" className="flex items-center gap-2 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
          <Check className="size-4" aria-hidden /> Demande envoyée. Notre équipe la traite et vous prévient par e-mail.
        </p>
      )}

      <Card className="p-5">
        <form
          className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.2fr_1fr_0.8fr_1fr_auto] lg:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            setSelected(null);
            void search();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="nm-country">Pays</Label>
            <Select
              id="nm-country"
              value={country}
              onChange={(e) => {
                setCountry(e.target.value);
                setNetwork("");
              }}
            >
              {MARKET_COUNTRIES.map((x) => (
                <option key={x.code} value={x.code}>
                  {x.label} (+{x.dial}){availability[x.code] ? ` — ${availability[x.code]} dispo.` : ""}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nm-network">Réseau</Label>
            <Select id="nm-network" value={network} onChange={(e) => setNetwork(e.target.value)}>
              <option value="">Tous les réseaux</option>
              {c?.networks.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nm-kind">Type</Label>
            <Select id="nm-kind" value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="">Tous</option>
              {NUMBER_KINDS.map((x) => (
                <option key={x.id} value={x.id}>
                  {x.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nm-prefix">Commence par</Label>
            <Input
              id="nm-prefix"
              inputMode="numeric"
              placeholder="ex. 95, 60, 66"
              value={prefix}
              onChange={(e) => setPrefix(cleanPrefix(e.target.value))}
            />
          </div>
          <Button type="submit" variant="brand" disabled={loading}>
            {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Search className="size-4" aria-hidden />}
            Rechercher
          </Button>
        </form>
        <p className="mt-3 text-xs text-muted-foreground">
          Le filtre « Commence par » s&apos;applique aux chiffres après l&apos;indicatif (+{c?.dial}) : « 95 » trouve aussi les
          numéros en 01 95…
        </p>
      </Card>

      <section aria-labelledby="nm-results" className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="nm-results" className="text-[0.95rem] font-semibold tracking-tight">
            Numéros disponibles — {c?.label}
          </h2>
          {offers && <span className="text-sm text-muted-foreground">{offers.length} résultat(s)</span>}
        </div>

        {searchError && <p className="text-sm text-rose-300">{searchError}</p>}

        {offers === null ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl bg-secondary/40" />
            ))}
          </div>
        ) : offers.length === 0 ? (
          <Card className="p-5">
            <p className="font-medium">
              {inStock === 0 ? `Pas encore de numéros en stock pour ${c?.label}.` : "Aucun numéro ne correspond à ces filtres."}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Laissez quand même votre demande : nous cherchons un numéro auprès de nos opérateurs partenaires et vous
              prévenons dès qu&apos;il est prêt.
            </p>
            <Button className="mt-3" variant="secondary" onClick={() => setSelected("free")} disabled={!canRequest}>
              Faire une demande pour {c?.label}
            </Button>
          </Card>
        ) : (
          <>
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {offers.map((o) => {
                const active = selected !== "free" && selected?.id === o.id;
                return (
                  <li key={o.id}>
                    <button
                      type="button"
                      onClick={() => setSelected(o)}
                      disabled={!canRequest}
                      aria-pressed={active}
                      className={`w-full rounded-xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-not-allowed ${
                        active ? "border-brand bg-brand-50" : "border-border bg-card hover:border-foreground/25"
                      }`}
                    >
                      <span className="mono block text-[1.05rem] font-semibold tracking-tight">
                        {formatMarketNumber(o.number, o.country)}
                      </span>
                      <span className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                        <Badge variant="outline">{networkLabel(o.country, o.network)}</Badge>
                        <span>{o.kind === "fixe" ? "Fixe" : "Mobile"}</span>
                      </span>
                      <span className="mt-2 block text-sm">
                        <strong>{formatXof(o.monthlyPriceXof)}</strong>
                        <span className="text-muted-foreground"> / mois</span>
                        {o.setupPriceXof > 0 && (
                          <span className="text-muted-foreground"> · mise en service {formatXof(o.setupPriceXof)}</span>
                        )}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <p className="text-sm text-muted-foreground">
              Vous ne trouvez pas le numéro voulu ?{" "}
              <button type="button" className="text-brand-400 underline-offset-4 hover:underline" onClick={() => setSelected("free")} disabled={!canRequest}>
                Faites une demande sur mesure
              </button>
              .
            </p>
          </>
        )}
        {!canRequest && (
          <p className="text-sm text-muted-foreground">Seuls les administrateurs de l&apos;organisation peuvent demander un numéro.</p>
        )}
      </section>

      {selected && canRequest && (
        <div ref={formRef}>
          <RequestForm
            key={selected === "free" ? `free-${country}` : selected.id}
            country={country}
            network={network}
            prefix={prefix}
            offer={selected === "free" ? null : selected}
            defaults={defaultContact}
            onCancel={() => setSelected(null)}
            onDone={() => {
              setSelected(null);
              setDone(true);
              void search();
              router.refresh();
            }}
          />
        </div>
      )}

      <MyRequests requests={requests} canCancel={canRequest} />
    </div>
  );
}

function RequestForm({
  country,
  network,
  prefix,
  offer,
  defaults,
  onCancel,
  onDone,
}: {
  country: string;
  network: string;
  prefix: string;
  offer: StockOffer | null;
  defaults: { companyName: string; contactName: string; contactEmail: string };
  onCancel: () => void;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [wantedNetwork, setWantedNetwork] = useState(network);
  const c = marketCountry(country);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const get = (k: string) => String(f.get(k) ?? "").trim();
    setBusy(true);
    setError(null);
    const res = await requestNumber({
      country,
      network: offer ? undefined : wantedNetwork || undefined,
      desiredPrefix: offer ? undefined : get("desiredPrefix") || undefined,
      stockId: offer?.id,
      companyName: get("companyName"),
      contactName: get("contactName"),
      contactPhone: get("contactPhone"),
      contactEmail: get("contactEmail"),
      businessId: get("businessId") || undefined,
      taxId: get("taxId") || undefined,
      address: get("address"),
      usage: get("usage") || undefined,
    });
    setBusy(false);
    if (res.error) return setError(res.error);
    onDone();
  }

  const title = useMemo(
    () => (offer ? `Demander le ${formatMarketNumber(offer.number, offer.country)}` : `Demande de numéro — ${c?.label}`),
    [offer, c],
  );

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-[0.95rem] font-semibold tracking-tight">
            <Phone className="size-4 text-brand-400" aria-hidden /> {title}
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {offer
              ? `${networkLabel(offer.country, offer.network)} · ${formatXof(offer.monthlyPriceXof)} par mois. Le numéro vous est réservé pendant l'examen de la demande.`
              : "Indiquez le réseau et le début de numéro souhaités : nous vous proposons un numéro dès que possible."}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onCancel} aria-label="Fermer le formulaire">
          <X className="size-4" aria-hidden />
        </Button>
      </div>

      <form onSubmit={submit} className="mt-4 grid gap-4 sm:grid-cols-2">
        {!offer && (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="rf-network">Réseau souhaité</Label>
              <Select id="rf-network" value={wantedNetwork} onChange={(e) => setWantedNetwork(e.target.value)}>
                <option value="">Peu importe</option>
                {c?.networks.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.label}
                  </option>
                ))}
              </Select>
            </div>
            <Field id="desiredPrefix" label="Début de numéro souhaité" placeholder="ex. 95" defaultValue={prefix} inputMode="numeric" maxLength={12} />
          </>
        )}
        <Field id="companyName" label="Entreprise" required defaultValue={defaults.companyName} maxLength={120} autoComplete="organization" />
        <Field id="contactName" label="Nom du responsable" required defaultValue={defaults.contactName} maxLength={120} autoComplete="name" />
        <Field id="contactPhone" label="Téléphone" required type="tel" placeholder={`+${c?.dial ?? ""} …`} maxLength={30} autoComplete="tel" />
        <Field id="contactEmail" label="E-mail" required type="email" defaultValue={defaults.contactEmail} maxLength={160} autoComplete="email" />
        <Field id="businessId" label="RCCM (ou n° d'immatriculation)" maxLength={60} />
        <Field id="taxId" label="IFU (ou n° fiscal)" maxLength={60} />
        <div className="space-y-1.5 sm:col-span-2">
          <Field id="address" label="Adresse de l'entreprise" required maxLength={240} autoComplete="street-address" />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="usage">Utilisation prévue (facultatif)</Label>
          <Textarea id="usage" name="usage" rows={3} maxLength={400} placeholder="ex. accueil téléphonique de la clinique, prise de rendez-vous" />
        </div>
        <p className="text-xs text-muted-foreground sm:col-span-2">
          Ces informations servent à identifier le titulaire du numéro, comme l&apos;exige la réglementation. Notre équipe peut
          vous demander une copie du RCCM et d&apos;une pièce d&apos;identité.
        </p>
        {error && (
          <p role="alert" className="text-sm text-rose-300 sm:col-span-2">
            {error}
          </p>
        )}
        <div className="flex gap-2 sm:col-span-2">
          <Button type="submit" variant="brand" disabled={busy}>
            {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
            Envoyer la demande
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel}>
            Annuler
          </Button>
        </div>
      </form>
    </Card>
  );
}

function Field({
  id,
  label,
  required,
  ...rest
}: { id: string; label: string; required?: boolean } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>
        {label}
        {required && <span className="text-rose-300"> *</span>}
      </Label>
      <Input id={id} name={id} required={required} {...rest} />
    </div>
  );
}

function MyRequests({ requests, canCancel }: { requests: RequestRow[]; canCancel: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  if (requests.length === 0) return null;

  async function cancel(id: string) {
    if (!window.confirm("Annuler cette demande ?")) return;
    setBusy(id);
    const res = await cancelMyNumberRequest(id);
    setBusy(null);
    if (res.error) window.alert(res.error);
    router.refresh();
  }

  return (
    <section aria-labelledby="nm-mine" className="space-y-3">
      <h2 id="nm-mine" className="text-[0.95rem] font-semibold tracking-tight">
        Mes demandes
      </h2>
      <ul className="divide-y divide-border rounded-xl border border-border">
        {requests.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
            <Badge variant={STATUS_VARIANT[r.status] ?? "muted"}>{REQUEST_STATUS_LABEL[r.status] ?? r.status}</Badge>
            <span className="min-w-0 flex-1">
              {r.assignedNumber ? (
                <span className="mono font-medium">{formatMarketNumber(r.assignedNumber, r.country)}</span>
              ) : (
                <span>
                  {marketCountry(r.country)?.label} · {networkLabel(r.country, r.network)}
                  {r.desiredPrefix ? ` · commence par ${r.desiredPrefix}` : ""}
                </span>
              )}
              <span className="text-muted-foreground"> · {new Date(r.createdAt).toLocaleDateString("fr-FR")}</span>
              {r.adminNote && <span className="block text-xs text-muted-foreground">Note de l&apos;équipe : {r.adminNote}</span>}
            </span>
            {r.status === "pending" && canCancel && (
              <Button size="sm" variant="ghost" disabled={busy === r.id} onClick={() => cancel(r.id)}>
                Annuler
              </Button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
