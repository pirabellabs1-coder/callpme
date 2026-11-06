"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowDown, ArrowUp, Loader2, Pencil, Plus, Search, Trash2 } from "lucide-react";
import {
  deleteCatalogVoice,
  importVoiceToCatalog,
  listElevenLabsAccountVoices,
  moveCatalogVoice,
  searchVoiceLibrary,
  updateCatalogVoice,
} from "@/app/actions/admin-voices";
import type { LibraryVoice } from "@/lib/voices/elevenlabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { SamplePlayButton } from "@/components/voices/sample-play-button";

export interface CatalogVoiceView {
  id: string;
  name: string;
  description: string | null;
  gender: string | null;
  age: string | null;
  accent: string | null;
  useCase: string | null;
  previewUrl: string | null;
  active: boolean;
}

const GENDER: Record<string, string> = { feminine: "Femme", masculine: "Homme", neutral: "Neutre" };
const AGE: Record<string, string> = { young: "Jeune", middle_aged: "Adulte", old: "Senior" };

function meta(v: { gender: string | null; age: string | null; accent: string | null; useCase?: string | null }) {
  return [v.gender ? GENDER[v.gender] : null, v.age ? (AGE[v.age] ?? v.age) : null, v.accent, v.useCase?.replace(/_/g, " ")]
    .filter(Boolean)
    .join(" · ");
}

function ErrorLine({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <p role="alert" className="flex items-center gap-2 text-sm text-destructive">
      <AlertCircle className="size-4 shrink-0" aria-hidden /> {text}
    </p>
  );
}

/* ------------------------------ Catalogue ------------------------------ */

function CatalogRow({ v, first, last }: { v: CatalogVoiceView; first: boolean; last: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: v.name,
    description: v.description ?? "",
    gender: v.gender ?? "",
    accent: v.accent ?? "",
  });

  function run(action: () => Promise<{ error?: string }>, after?: () => void) {
    setError(null);
    start(async () => {
      const r = await action();
      if (r.error) setError(r.error);
      else {
        after?.();
        router.refresh();
      }
    });
  }

  const save = (active = v.active) =>
    updateCatalogVoice(v.id, {
      name: form.name,
      description: form.description || null,
      gender: (form.gender || null) as "feminine" | "masculine" | "neutral" | null,
      accent: form.accent || null,
      active,
    });

  return (
    <li className="space-y-3 py-3">
      <div className="flex flex-wrap items-center gap-3">
        {v.previewUrl ? <SamplePlayButton src={v.previewUrl} label={`Écouter ${v.name}`} /> : <span className="size-8" />}
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-sm font-medium">
            {v.name}
            {!v.active && <Badge variant="muted">Désactivée</Badge>}
          </p>
          <p className="text-xs text-muted-foreground">{meta(v) || "—"}</p>
          {v.description && <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{v.description}</p>}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" disabled={pending || first} aria-label={`Monter ${v.name}`} onClick={() => run(() => moveCatalogVoice(v.id, "up"))}>
            <ArrowUp aria-hidden />
          </Button>
          <Button variant="ghost" size="sm" disabled={pending || last} aria-label={`Descendre ${v.name}`} onClick={() => run(() => moveCatalogVoice(v.id, "down"))}>
            <ArrowDown aria-hidden />
          </Button>
          <Button variant="outline" size="sm" disabled={pending} onClick={() => run(() => save(!v.active))}>
            {v.active ? "Désactiver" : "Activer"}
          </Button>
          <Button variant="ghost" size="sm" disabled={pending} aria-label={`Modifier ${v.name}`} onClick={() => setEditing((e) => !e)}>
            <Pencil aria-hidden />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={pending}
            aria-label={`Retirer ${v.name} du catalogue`}
            onClick={() => {
              if (window.confirm(`Retirer « ${v.name} » du catalogue ?`)) run(() => deleteCatalogVoice(v.id));
            }}
          >
            <Trash2 aria-hidden />
          </Button>
        </div>
      </div>
      {editing && (
        <form
          className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            run(save, () => setEditing(false));
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor={`n-${v.id}`}>Nom affiché aux clients</Label>
            <Input id={`n-${v.id}`} value={form.name} maxLength={60} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`g-${v.id}`}>Genre</Label>
            <Select id={`g-${v.id}`} value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
              <option value="">—</option>
              <option value="feminine">Femme</option>
              <option value="masculine">Homme</option>
              <option value="neutral">Neutre</option>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`a-${v.id}`}>Accent</Label>
            <Input id={`a-${v.id}`} value={form.accent} maxLength={60} placeholder="ex. ouest-africain" onChange={(e) => setForm({ ...form, accent: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`d-${v.id}`}>Description</Label>
            <Input id={`d-${v.id}`} value={form.description} maxLength={300} placeholder="ex. Chaleureuse, idéale pour l'accueil" onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit" variant="brand" size="sm" disabled={pending}>
              {pending && <Loader2 className="animate-spin" aria-hidden />} Enregistrer
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>
              Annuler
            </Button>
          </div>
        </form>
      )}
      <ErrorLine text={error} />
    </li>
  );
}

/* ------------------------------- Ajout -------------------------------- */

function LibraryCard({ v, inCatalog }: { v: LibraryVoice; inCatalog: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(v.name.split(/\s[-–—|]\s/)[0].slice(0, 60));
  const [description, setDescription] = useState((v.description ?? "").slice(0, 300));
  const [done, setDone] = useState(false);

  function add() {
    setError(null);
    start(async () => {
      const r = await importVoiceToCatalog({
        voiceId: v.voiceId,
        ownerId: v.source === "library" ? v.ownerId : null,
        name,
        description: description || null,
        gender: v.gender as "feminine" | "masculine" | "neutral" | null,
        age: v.age,
        accent: v.accent,
        language: v.language,
        useCase: v.useCase,
        previewUrl: v.previewUrl,
      });
      if (r.error) setError(r.error);
      else {
        setDone(true);
        setOpen(false);
        router.refresh();
      }
    });
  }

  return (
    <li className="space-y-2 rounded-lg border border-border p-3">
      <div className="flex items-start gap-3">
        {v.previewUrl && <SamplePlayButton src={v.previewUrl} label={`Écouter ${v.name}`} />}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{v.name}</p>
          <p className="text-xs text-muted-foreground">{meta(v) || "—"}</p>
          {v.description && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{v.description}</p>}
        </div>
        {done || inCatalog ? (
          <Badge variant="success">Au catalogue</Badge>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setOpen((o) => !o)}>
            <Plus aria-hidden /> Ajouter
          </Button>
        )}
      </div>
      {open && (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
        >
          <div className="space-y-1">
            <Label htmlFor={`in-${v.voiceId}`}>Nom affiché aux clients</Label>
            <Input id={`in-${v.voiceId}`} value={name} maxLength={60} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`id-${v.voiceId}`}>Description</Label>
            <Input id={`id-${v.voiceId}`} value={description} maxLength={300} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <Button type="submit" variant="brand" size="sm" disabled={pending}>
            {pending && <Loader2 className="animate-spin" aria-hidden />} Ajouter au catalogue
          </Button>
        </form>
      )}
      <ErrorLine text={error} />
    </li>
  );
}

function AddVoices({ catalogIds }: { catalogIds: Set<string> }) {
  const [tab, setTab] = useState<"library" | "account">("library");
  const [filters, setFilters] = useState({ search: "", gender: "", age: "", accent: "", useCase: "" });
  const [page, setPage] = useState(0);
  const [results, setResults] = useState<LibraryVoice[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function search(p = 0) {
    setError(null);
    start(async () => {
      const r = await searchVoiceLibrary({ ...filters, page: p });
      if (r.error) return setError(r.error);
      setPage(p);
      setHasMore(Boolean(r.hasMore));
      setResults(p === 0 ? (r.voices ?? []) : [...(results ?? []), ...(r.voices ?? [])]);
    });
  }

  function loadAccount() {
    setError(null);
    start(async () => {
      const r = await listElevenLabsAccountVoices();
      if (r.error) return setError(r.error);
      setHasMore(false);
      setResults(r.voices ?? []);
    });
  }

  return (
    <Card className="space-y-4 p-5">
      <div>
        <h2 className="text-[0.95rem] font-semibold tracking-tight">Ajouter des voix</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Écoutez les voix d&apos;ElevenLabs et ajoutez les meilleures au catalogue sous le nom de votre choix. Les clients ne voient que ce nom.
        </p>
      </div>
      <div role="tablist" aria-label="Source des voix" className="flex gap-1">
        {(
          [
            ["library", "Bibliothèque ElevenLabs"],
            ["account", "Mon compte ElevenLabs"],
          ] as const
        ).map(([id, label]) => (
          <Button
            key={id}
            role="tab"
            aria-selected={tab === id}
            variant={tab === id ? "secondary" : "ghost"}
            size="sm"
            onClick={() => {
              setTab(id);
              setResults(null);
              setError(null);
              if (id === "account") loadAccount();
            }}
          >
            {label}
          </Button>
        ))}
      </div>

      {tab === "library" && (
        <form
          className="grid gap-3 sm:grid-cols-6"
          onSubmit={(e) => {
            e.preventDefault();
            search(0);
          }}
        >
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="vs-q">Recherche</Label>
            <Input id="vs-q" value={filters.search} placeholder="ex. chaleureuse, africain, radio…" onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="vs-g">Genre</Label>
            <Select id="vs-g" value={filters.gender} onChange={(e) => setFilters({ ...filters, gender: e.target.value })}>
              <option value="">Tous</option>
              <option value="female">Femme</option>
              <option value="male">Homme</option>
              <option value="neutral">Neutre</option>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="vs-a">Âge</Label>
            <Select id="vs-a" value={filters.age} onChange={(e) => setFilters({ ...filters, age: e.target.value })}>
              <option value="">Tous</option>
              <option value="young">Jeune</option>
              <option value="middle_aged">Adulte</option>
              <option value="old">Senior</option>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="vs-u">Usage</Label>
            <Select id="vs-u" value={filters.useCase} onChange={(e) => setFilters({ ...filters, useCase: e.target.value })}>
              <option value="">Tous</option>
              <option value="conversational">Conversation</option>
              <option value="narrative_story">Narration</option>
              <option value="informative_educational">Information</option>
              <option value="advertisement">Publicité</option>
              <option value="characters_animation">Personnage</option>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="vs-ac">Accent</Label>
            <Input id="vs-ac" value={filters.accent} placeholder="ex. african" onChange={(e) => setFilters({ ...filters, accent: e.target.value })} />
          </div>
          <div className="sm:col-span-6">
            <Button type="submit" variant="brand" size="sm" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Search aria-hidden />} Rechercher les voix françaises
            </Button>
          </div>
        </form>
      )}

      <ErrorLine text={error} />
      {pending && !results && <p className="text-sm text-muted-foreground">Chargement…</p>}
      {results && results.length === 0 && <p className="text-sm text-muted-foreground">Aucune voix ne correspond.</p>}
      {results && results.length > 0 && (
        <ul className="grid gap-2 md:grid-cols-2">
          {results.map((v) => (
            <LibraryCard key={`${v.source}-${v.voiceId}`} v={v} inCatalog={catalogIds.has(v.voiceId)} />
          ))}
        </ul>
      )}
      {tab === "library" && hasMore && (
        <Button variant="outline" size="sm" disabled={pending} onClick={() => search(page + 1)}>
          {pending && <Loader2 className="animate-spin" aria-hidden />} Plus de voix
        </Button>
      )}
    </Card>
  );
}

export function AdminVoiceLibrary({
  catalog,
  catalogExternalIds,
  configured,
}: {
  catalog: CatalogVoiceView[];
  catalogExternalIds: string[];
  configured: boolean;
}) {
  const active = catalog.filter((v) => v.active).length;
  return (
    <div className="space-y-6">
      <Card className="p-5">
        <h2 className="text-[0.95rem] font-semibold tracking-tight">
          Catalogue Callpme <span className="font-normal text-muted-foreground">· {active} voix proposées aux clients</span>
        </h2>
        {catalog.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Le catalogue est vide : les clients ne peuvent pas encore choisir de voix. Ajoutez-en ci-dessous.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-border">
            {catalog.map((v, i) => (
              <CatalogRow key={v.id} v={v} first={i === 0} last={i === catalog.length - 1} />
            ))}
          </ul>
        )}
      </Card>
      {configured ? (
        <AddVoices catalogIds={new Set(catalogExternalIds)} />
      ) : (
        <Card className="p-5 text-sm text-muted-foreground">
          Renseignez ELEVENLABS_API_KEY sur le serveur pour ajouter des voix.
        </Card>
      )}
    </div>
  );
}
