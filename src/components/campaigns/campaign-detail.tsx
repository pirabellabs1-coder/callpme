"use client";

import { useId, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Play,
  Pause,
  Upload,
  Loader2,
  Megaphone,
  Trash2,
  AlertCircle,
  CheckCircle2,
  FileUp,
  Info,
  Users,
  PhoneCall,
  PhoneIncoming,
  Percent,
} from "lucide-react";
import type { ContactRecord } from "@/lib/db/campaigns";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { StatCard } from "@/components/ui/stat";
import { EmptyState } from "@/components/ui/empty-state";
import {
  CampaignStatusBadge,
  CONTACT_STATUS,
  CONTACT_STATUS_ORDER,
  ProgressBar,
} from "./campaign-ui";

const MAX_CONTACTS = 5000;
const PAGE_SIZE = 100;

/* ------------------------------ Parsing CSV ------------------------------- */

interface ParsedContact {
  name: string;
  phone: string;
}
interface ParseIssue {
  line: number;
  text: string;
  reason: string;
}

const phoneDigits = (p: string) => p.replace(/[\s.\-()]/g, "");
const isPhone = (p: string) => /^(\+|00)?\d{6,15}$/.test(phoneDigits(p));

function parseContacts(raw: string, existingPhones: Set<string>) {
  const valid: ParsedContact[] = [];
  const issues: ParseIssue[] = [];
  const seen = new Set(existingPhones);
  let duplicates = 0;

  raw.split(/\r?\n/).forEach((rawLine, idx) => {
    const line = rawLine.trim();
    if (!line) return;
    const parts = line
      .split(/[;,\t]/)
      .map((p) => p.trim().replace(/^"(.*)"$/, "$1").trim());

    let name = "";
    let phone = "";
    if (parts.length === 1) phone = parts[0];
    else if (isPhone(parts[0]) && !isPhone(parts[1])) {
      phone = parts[0];
      name = parts[1];
    } else {
      name = parts[0];
      phone = parts[1];
    }

    // Ligne d'en-tête (« nom;téléphone ») : ignorée silencieusement.
    if (idx === 0 && !/\d/.test(phone)) return;

    if (!phone) {
      issues.push({ line: idx + 1, text: line, reason: "numéro manquant" });
      return;
    }
    if (!isPhone(phone)) {
      issues.push({ line: idx + 1, text: line, reason: "numéro invalide" });
      return;
    }
    const key = phoneDigits(phone).replace(/^00/, "+");
    if (seen.has(key)) {
      duplicates += 1;
      return;
    }
    seen.add(key);
    valid.push({ name: (name || "Contact").slice(0, 120), phone: phone.replace(/\s+/g, " ") });
  });

  return { valid, issues, duplicates };
}

/* -------------------------------- Composant ------------------------------- */

export function CampaignDetail({
  campaign,
}: {
  campaign: {
    id: string;
    name: string;
    status: string;
    agentName: string;
    createdAt?: string;
    contacts: ContactRecord[];
  };
}) {
  const router = useRouter();
  const ids = useId();
  const [csv, setCsv] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [running, setRunning] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(campaign.contacts.length === 0);
  const [filter, setFilter] = useState<string>("all");
  const [visible, setVisible] = useState(PAGE_SIZE);

  const contacts = campaign.contacts;
  const total = contacts.length;
  const byStatus = useMemo(() => {
    const m: Record<string, number> = {};
    for (const c of contacts) m[c.status] = (m[c.status] ?? 0) + 1;
    return m;
  }, [contacts]);
  const pending = byStatus.pending ?? 0;
  const called = total - pending;
  const reached = byStatus.completed ?? 0;
  const pct = total > 0 ? Math.round((called / total) * 100) : 0;
  const reachRate = called > 0 ? Math.round((reached / called) * 100) : null;

  const outcomes = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of contacts) if (c.outcome) m.set(c.outcome, (m.get(c.outcome) ?? 0) + 1);
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [contacts]);

  const existingPhones = useMemo(
    () => new Set(contacts.map((c) => phoneDigits(c.phone).replace(/^00/, "+"))),
    [contacts],
  );
  const parsed = useMemo(
    () => (csv.trim() ? parseContacts(csv, existingPhones) : null),
    [csv, existingPhones],
  );
  const overCapacity = parsed ? total + parsed.valid.length > MAX_CONTACTS : false;

  const paused = campaign.status === "paused";
  const done = campaign.status === "completed";
  const filtered = filter === "all" ? contacts : contacts.filter((c) => c.status === filter);

  async function importContacts() {
    if (!parsed || parsed.valid.length === 0) {
      setError("Aucun contact valide détecté. Format attendu : nom, téléphone (une ligne par contact).");
      return;
    }
    if (overCapacity) {
      setError(`Une campagne est limitée à ${MAX_CONTACTS.toLocaleString("fr-FR")} contacts.`);
      return;
    }
    setImporting(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/campaigns/${campaign.id}/contacts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contacts: parsed.valid }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const added = typeof data.added === "number" ? data.added : parsed.valid.length;
        setNotice(`${added} contact${added > 1 ? "s" : ""} importé${added > 1 ? "s" : ""}.`);
        setCsv("");
        setFileName(null);
        setShowImport(false);
        router.refresh();
      } else {
        setError(data.error ?? "Échec de l'import des contacts.");
      }
    } catch {
      setError("Erreur réseau pendant l'import. Réessayez.");
    }
    setImporting(false);
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setError("Fichier trop volumineux (2 Mo maximum).");
      return;
    }
    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      setCsv(String(reader.result ?? ""));
      setFileName(file.name);
    };
    reader.onerror = () => setError("Impossible de lire ce fichier.");
    reader.readAsText(file);
  }

  async function run() {
    setRunning(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/campaigns/${campaign.id}/run`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const n = typeof data.processed === "number" ? data.processed : null;
        if (n !== null) {
          setNotice(
            data.real
              ? `${data.placed ?? 0} appel(s) lancé(s)${data.failed ? `, ${data.failed} en échec` : ""}. Les issues s'afficheront à la fin de chaque appel.`
              : `${n} contact${n > 1 ? "s" : ""} traité${n > 1 ? "s" : ""}.`,
          );
        }
      } else setError(data.error ?? "Le lancement de la campagne a échoué.");
    } catch {
      setError("Erreur réseau : la campagne n'a pas pu être lancée.");
    }
    router.refresh();
    setRunning(false);
  }

  async function setStatus(status: string) {
    setWorking(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/campaigns/${campaign.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) router.refresh();
      else setError("Action impossible.");
    } catch {
      setError("Erreur réseau. Réessayez.");
    }
    setWorking(false);
  }

  async function remove() {
    if (!window.confirm(`Supprimer la campagne « ${campaign.name} » et ses ${total} contacts ? Cette action est définitive.`)) return;
    setWorking(true);
    setError(null);
    try {
      const res = await fetch(`/api/campaigns/${campaign.id}`, { method: "DELETE" });
      if (res.ok) {
        router.push("/campaigns");
        router.refresh();
        return;
      }
      setError("Suppression impossible.");
    } catch {
      setError("Erreur réseau. Réessayez.");
    }
    setWorking(false);
  }

  const created = campaign.createdAt
    ? new Date(campaign.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" })
    : null;

  return (
    <div className="space-y-6">
      <Link
        href="/campaigns"
        className="inline-flex items-center gap-1.5 rounded-md text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/55"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Campagnes
      </Link>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-inset ring-brand-600/15">
            <Megaphone className="size-6" strokeWidth={1.75} aria-hidden />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-display-sm font-semibold tracking-tight">{campaign.name}</h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <CampaignStatusBadge status={campaign.status} />
              <span>Agent : {campaign.agentName}</span>
              {created && <span>Créée le {created}</span>}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowImport((v) => !v)}
            aria-expanded={showImport}
            aria-controls={`${ids}-import`}
          >
            <Upload className="size-4" aria-hidden />
            Importer des contacts
          </Button>
          {!done &&
            (paused ? (
              <Button variant="outline" size="sm" onClick={() => setStatus("draft")} disabled={working}>
                <Play className="size-4" aria-hidden />
                Reprendre
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStatus("paused")}
                disabled={working || total === 0}
              >
                <Pause className="size-4" aria-hidden />
                Mettre en pause
              </Button>
            ))}
          <Button
            variant="outline"
            size="sm"
            onClick={remove}
            disabled={working}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="size-4" aria-hidden />
            Supprimer
          </Button>
          <Button variant="brand" onClick={run} disabled={running || pending === 0 || paused}>
            {running ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Play className="size-4" aria-hidden />}
            {running ? "Lancement…" : called > 0 && pending > 0 ? "Continuer" : "Lancer la campagne"}
          </Button>
        </div>
      </div>

      {/* Pourquoi le bouton est inactif */}
      {total > 0 && (paused || pending === 0) && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Info className="size-3.5 shrink-0" aria-hidden />
          {paused
            ? "Campagne en pause : reprenez-la pour relancer les appels."
            : "Tous les contacts ont été appelés. Importez de nouveaux contacts pour continuer."}
        </p>
      )}

      <div aria-live="polite" className="empty:hidden">
        {error && (
          <p role="alert" className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="size-4 shrink-0" aria-hidden />
            {error}
          </p>
        )}
        {!error && notice && (
          <p className="flex items-center gap-2 rounded-lg border border-emerald-600/25 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            <CheckCircle2 className="size-4 shrink-0" aria-hidden />
            {notice}
          </p>
        )}
      </div>

      {/* Indicateurs */}
      {total > 0 && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Contacts" value={total} icon={Users} />
          <StatCard label="Appelés" value={called} hint={`${pct} % de la liste`} icon={PhoneCall} />
          <StatCard label="Joints" value={reached} hint="Conversation aboutie" icon={PhoneIncoming} />
          <StatCard
            label="Taux de joignabilité"
            value={reachRate === null ? "—" : `${reachRate} %`}
            hint="Joints / appelés"
            icon={Percent}
          />
        </div>
      )}

      {/* Progression + répartition */}
      {total > 0 && (
        <Card className="p-5">
          <div className="flex items-center justify-between text-sm">
            <h2 className="font-medium text-foreground">Progression</h2>
            <span className="tabular text-muted-foreground">
              {called}/{total} contacts · {pct} %
            </span>
          </div>
          <ProgressBar value={pct} label="Progression de la campagne" className="mt-2 h-2.5" />

          <h3 className="mt-5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Répartition par statut
          </h3>
          <div className="mt-2 flex h-2.5 overflow-hidden rounded-full bg-secondary" aria-hidden>
            {CONTACT_STATUS_ORDER.map((k) =>
              byStatus[k] ? (
                <div
                  key={k}
                  className={CONTACT_STATUS[k].bar}
                  style={{ width: `${(byStatus[k] / total) * 100}%` }}
                />
              ) : null,
            )}
          </div>
          <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs">
            {CONTACT_STATUS_ORDER.filter((k) => byStatus[k]).map((k) => (
              <li key={k} className="inline-flex items-center gap-1.5">
                <span className={cn("size-2 rounded-full", CONTACT_STATUS[k].bar)} aria-hidden />
                <span className="text-muted-foreground">{CONTACT_STATUS[k].label}</span>
                <span className="tabular font-medium text-foreground">{byStatus[k]}</span>
              </li>
            ))}
          </ul>

          {outcomes.length > 0 && (
            <>
              <h3 className="mt-5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Résultats des appels
              </h3>
              <ul className="mt-2 space-y-2">
                {outcomes.map(([label, n]) => {
                  const share = Math.round((n / called) * 100);
                  return (
                    <li key={label} className="grid grid-cols-[minmax(0,10rem)_1fr_auto] items-center gap-3 text-sm">
                      <span className="truncate text-foreground" title={label}>{label}</span>
                      <span className="h-1.5 overflow-hidden rounded-full bg-secondary" aria-hidden>
                        <span
                          className="block h-full origin-left rounded-full bg-brand/70"
                          style={{ transform: `scaleX(${n / Math.max(called, 1)})` }}
                        />
                      </span>
                      <span className="tabular text-xs text-muted-foreground">
                        {n} · {share} %
                      </span>
                    </li>
                  );
                })}
              </ul>
            </>
          )}

          <p className="mt-5 flex items-start gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
            <Info className="mt-px size-3.5 shrink-0" aria-hidden />
            Les appels partent dès le lancement : aucune plage horaire n'est programmée pour
            cette campagne. Lancez-la pendant des horaires adaptés à vos contacts.
          </p>
        </Card>
      )}

      {/* Import */}
      {showImport && (
        <Card className="p-5" id={`${ids}-import`}>
          <h2 className="text-[0.95rem] font-semibold tracking-tight">Importer des contacts</h2>
          <div className="mt-2 grid gap-4 lg:grid-cols-[1fr_16rem]">
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Collez vos contacts (une ligne par contact) ou chargez un fichier CSV exporté
                de votre tableur ou CRM.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <label
                  htmlFor={`${ids}-file`}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border bg-secondary/40 px-3 py-2 text-xs font-medium text-foreground/80 transition-colors hover:bg-secondary/70 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring/55"
                >
                  <FileUp className="size-3.5" aria-hidden />
                  Choisir un fichier CSV
                  <input
                    id={`${ids}-file`}
                    type="file"
                    accept=".csv,.txt,text/csv,text/plain"
                    onChange={onFile}
                    className="sr-only"
                  />
                </label>
                {fileName && <span className="truncate text-xs text-muted-foreground">{fileName}</span>}
              </div>
              <label htmlFor={`${ids}-csv`} className="sr-only">
                Contacts à importer, au format nom, téléphone
              </label>
              <Textarea
                id={`${ids}-csv`}
                value={csv}
                onChange={(e) => {
                  setCsv(e.target.value);
                  setFileName(null);
                }}
                rows={7}
                spellCheck={false}
                className="font-mono text-xs"
                placeholder={"nom;telephone\nMarie Durand;+33 6 12 34 56 78\nAmadou Diallo;+221 77 123 45 67"}
                aria-describedby={`${ids}-format ${ids}-check`}
              />

              {parsed && (
                <div id={`${ids}-check`} aria-live="polite" className="space-y-2 text-sm">
                  <p className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    <span className="inline-flex items-center gap-1.5 text-emerald-700">
                      <CheckCircle2 className="size-4" aria-hidden />
                      {parsed.valid.length} contact{parsed.valid.length > 1 ? "s" : ""} valide{parsed.valid.length > 1 ? "s" : ""}
                    </span>
                    {parsed.duplicates > 0 && (
                      <span className="text-muted-foreground">
                        {parsed.duplicates} doublon{parsed.duplicates > 1 ? "s" : ""} ignoré{parsed.duplicates > 1 ? "s" : ""}
                      </span>
                    )}
                    {parsed.issues.length > 0 && (
                      <span className="inline-flex items-center gap-1.5 text-destructive">
                        <AlertCircle className="size-4" aria-hidden />
                        {parsed.issues.length} ligne{parsed.issues.length > 1 ? "s" : ""} en erreur (ignorée{parsed.issues.length > 1 ? "s" : ""})
                      </span>
                    )}
                  </p>
                  {parsed.issues.length > 0 && (
                    <ul className="max-h-36 space-y-1 overflow-auto rounded-lg border border-destructive/25 bg-destructive/5 p-2 font-mono text-xs">
                      {parsed.issues.slice(0, 50).map((i) => (
                        <li key={i.line} className="flex gap-2">
                          <span className="shrink-0 text-muted-foreground">L{i.line}</span>
                          <span className="truncate text-foreground/80">{i.text}</span>
                          <span className="shrink-0 text-destructive">— {i.reason}</span>
                        </li>
                      ))}
                      {parsed.issues.length > 50 && (
                        <li className="text-muted-foreground">… et {parsed.issues.length - 50} autres</li>
                      )}
                    </ul>
                  )}
                  {overCapacity && (
                    <p className="text-destructive">
                      Limite de {MAX_CONTACTS.toLocaleString("fr-FR")} contacts par campagne dépassée
                      ({total} déjà présents).
                    </p>
                  )}
                </div>
              )}

              <Button
                variant="brand"
                onClick={importContacts}
                disabled={importing || !parsed || parsed.valid.length === 0 || overCapacity}
              >
                {importing ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Upload className="size-4" aria-hidden />}
                {parsed && parsed.valid.length > 0
                  ? `Importer ${parsed.valid.length} contact${parsed.valid.length > 1 ? "s" : ""}`
                  : "Importer les contacts"}
              </Button>
            </div>

            <aside
              id={`${ids}-format`}
              className="rounded-lg border border-border bg-secondary/30 p-3 text-xs text-muted-foreground"
            >
              <p className="font-medium text-foreground">Format attendu</p>
              <ul className="mt-2 list-disc space-y-1 pl-4">
                <li>
                  Deux colonnes : <code className="font-mono text-foreground/80">nom</code> puis{" "}
                  <code className="font-mono text-foreground/80">téléphone</code>.
                </li>
                <li>Séparateur : virgule, point-virgule ou tabulation.</li>
                <li>Une ligne d'en-tête est ignorée automatiquement.</li>
                <li>
                  Numéros au format international recommandé (
                  <span className="font-mono">+33…</span>, <span className="font-mono">+225…</span>).
                </li>
                <li>Les doublons sont ignorés. {MAX_CONTACTS.toLocaleString("fr-FR")} contacts max.</li>
              </ul>
            </aside>
          </div>
        </Card>
      )}

      {/* Contacts */}
      {total === 0 ? (
        !showImport && (
          <EmptyState
            icon={Users}
            title="Aucun contact dans cette campagne"
            description="Importez votre liste pour que l'agent puisse commencer à appeler."
            action={
              <Button variant="brand" size="sm" onClick={() => setShowImport(true)}>
                <Upload className="size-4" aria-hidden />
                Importer des contacts
              </Button>
            }
          />
        )
      ) : (
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-secondary/40 px-5 py-2.5">
            <h2 className="text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground">
              Contacts
            </h2>
            <div role="group" aria-label="Filtrer les contacts par statut" className="flex flex-wrap gap-1.5">
              {[["all", "Tous", total] as const, ...CONTACT_STATUS_ORDER.filter((k) => byStatus[k]).map((k) => [k, CONTACT_STATUS[k].label, byStatus[k]] as const)].map(
                ([key, label, n]) => (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={filter === key}
                    onClick={() => {
                      setFilter(key);
                      setVisible(PAGE_SIZE);
                    }}
                    className={cn(
                      "rounded-full px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/55",
                      filter === key
                        ? "bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-600/25"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground",
                    )}
                  >
                    {label} <span className="tabular opacity-70">{n}</span>
                  </button>
                ),
              )}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Contacts de la campagne et issue de leur appel</caption>
              <thead className="text-left text-xs text-muted-foreground">
                <tr className="border-b border-border">
                  <th scope="col" className="px-5 py-2 font-medium">Contact</th>
                  <th scope="col" className="px-5 py-2 font-medium">Statut</th>
                  <th scope="col" className="hidden px-5 py-2 font-medium sm:table-cell">Issue</th>
                  <th scope="col" className="hidden px-5 py-2 font-medium md:table-cell">Appelé le</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.slice(0, visible).map((c) => {
                  const cs = CONTACT_STATUS[c.status] ?? CONTACT_STATUS.pending;
                  return (
                    <tr key={c.id}>
                      <td className="max-w-0 px-5 py-3 sm:max-w-none">
                        <p className="truncate font-medium text-foreground">{c.name}</p>
                        <p className="mono truncate text-xs text-muted-foreground">{c.phone}</p>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3">
                        <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", cs.text)}>
                          <span className={cn("size-1.5 rounded-full", cs.bar)} aria-hidden />
                          {cs.label}
                        </span>
                      </td>
                      <td className="hidden max-w-[16rem] truncate px-5 py-3 text-xs text-muted-foreground sm:table-cell">
                        {c.outcome ?? "—"}
                      </td>
                      <td className="hidden whitespace-nowrap px-5 py-3 text-xs text-muted-foreground md:table-cell">
                        {c.calledAt
                          ? new Date(c.calledAt).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Paris" })
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filtered.length > visible && (
            <div className="border-t border-border px-5 py-3 text-center">
              <Button variant="ghost" size="sm" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
                Afficher plus ({filtered.length - visible} restants)
              </Button>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
