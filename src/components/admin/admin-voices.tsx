"use client";

import { useState, useTransition } from "react";
import { Loader2, AlertCircle, Plus, Trash2, AudioLines, Link2 } from "lucide-react";
import { addVoiceAdmin, deleteVoiceAdmin, type AdminResult } from "@/app/actions/admin";
import {
  TTS_PROVIDERS,
  OPENAI_TTS_VOICES,
  type TtsProvider,
} from "@/lib/voices/catalog";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

interface VoiceRow {
  id: string;
  name: string;
  provider: string;
  status: string;
  gender: string | null;
  accent: string | null;
  orgName: string;
}

export function AdminVoices({ initial }: { initial: VoiceRow[] }) {
  const [voices, setVoices] = useState(initial);
  const [provider, setProvider] = useState<TtsProvider>("elevenlabs");
  const [voiceId, setVoiceId] = useState("");
  const [name, setName] = useState("");
  const [gender, setGender] = useState("feminine");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const meta = TTS_PROVIDERS.find((p) => p.id === provider)!;

  function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const fd = new FormData();
    fd.set("name", name);
    fd.set("provider", provider);
    fd.set("voiceId", voiceId);
    fd.set("gender", gender);
    start(async () => {
      const res: AdminResult = await addVoiceAdmin(fd);
      if (res.error) return setError(res.error);
      window.location.reload();
    });
  }

  async function remove(id: string) {
    if (!window.confirm("Supprimer cette voix ?")) return;
    setVoices((list) => list.filter((v) => v.id !== id));
    await deleteVoiceAdmin(id);
  }

  return (
    <div className="space-y-5">
      {/* Ajout par ID */}
      <Card className="p-5">
        <h2 className="flex items-center gap-2 text-[0.95rem] font-semibold tracking-tight">
          <Link2 className="size-4 text-muted-foreground" />
          Ajouter une voix par ID
        </h2>
        <form onSubmit={add} className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="provider">Provider</Label>
              <Select
                id="provider"
                value={provider}
                onChange={(e) => {
                  setProvider(e.target.value as TtsProvider);
                  setVoiceId("");
                }}
              >
                {TTS_PROVIDERS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="voiceId">{meta.idLabel}</Label>
              {provider === "openai" ? (
                <Select id="voiceId" value={voiceId} onChange={(e) => setVoiceId(e.target.value)}>
                  <option value="">— Choisir —</option>
                  {OPENAI_TTS_VOICES.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </Select>
              ) : (
                <Input
                  id="voiceId"
                  value={voiceId}
                  onChange={(e) => setVoiceId(e.target.value)}
                  placeholder={meta.idPlaceholder}
                />
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gender">Genre</Label>
              <Select id="gender" value={gender} onChange={(e) => setGender(e.target.value)}>
                <option value="feminine">Féminine</option>
                <option value="masculine">Masculine</option>
                <option value="neutral">Neutre</option>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="name">Nom de la voix</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Voix ElevenLabs Pro"
            />
          </div>
          {error && (
            <p className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="size-4 shrink-0" />
              {error}
            </p>
          )}
          <Button
            type="submit"
            variant="brand"
            disabled={pending || !name.trim() || !voiceId.trim()}
          >
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            Ajouter la voix
          </Button>
        </form>
      </Card>

      {/* Liste de toutes les voix */}
      {voices.length === 0 ? (
        <Card className="p-8 text-center">
          <AudioLines className="mx-auto size-7 text-muted-foreground/50" />
          <p className="mt-2 text-sm text-muted-foreground">Aucune voix sur la plateforme.</p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="border-b border-border bg-secondary/40 px-5 py-2.5 text-[0.7rem] font-semibold uppercase tracking-wide text-muted-foreground">
            {voices.length} voix
          </div>
          <div className="divide-y divide-border">
            {voices.map((v) => (
              <div key={v.id} className="flex items-center gap-4 px-5 py-3.5">
                <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-foreground/60 ring-1 ring-inset ring-border">
                  <AudioLines className="size-4" strokeWidth={1.75} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-medium text-foreground">{v.name}</p>
                    <Badge variant="muted">{v.provider}</Badge>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {v.orgName}
                    {v.gender ? ` · ${v.gender}` : ""}
                    {v.accent ? ` · ${v.accent}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => remove(v.id)}
                  className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/5 hover:text-destructive"
                  aria-label="Supprimer"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
