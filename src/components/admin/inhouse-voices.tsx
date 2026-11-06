"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Loader2, Mic, Plus, Square, Trash2, Upload } from "lucide-react";
import {
  cancelInhouseTraining,
  confirmInhouseTrainingDone,
  createInhouseVoice,
  deleteInhouseClip,
  publishInhouseVersion,
  retireInhouseVersion,
  revokeInhouseConsent,
  startInhouseTraining,
  type InhouseActionResult,
} from "@/app/actions/admin-inhouse-voices";
import { floatToPcm16, pcm16ToWav } from "@/lib/voices/inhouse/audio-format";
import { CLIP_LIMITS, formatDuration, SAMPLE_TEXT } from "@/lib/voices/inhouse/rules";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

/* ------------------------------- Communs ------------------------------- */

function ErrorLine({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <p role="alert" className="flex items-center gap-2 text-sm text-destructive">
      <AlertCircle className="size-4 shrink-0" aria-hidden /> {text}
    </p>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <Card className="space-y-4 p-5">
      <div>
        <h2 className="text-base font-semibold">{title}</h2>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </Card>
  );
}

/** Lance une action serveur, affiche l'erreur éventuelle et rafraîchit la page. */
function useAction() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<InhouseActionResult>, after?: (r: InhouseActionResult) => void) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (r.error) setError(r.error);
      else {
        after?.(r);
        router.refresh();
      }
    });
  return { pending, error, setError, run };
}

/** Envoi multipart vers une route admin ; renvoie le message d'erreur éventuel. */
async function postForm(url: string, form: FormData): Promise<string | null> {
  const res = await fetch(url, { method: "POST", body: form }).catch(() => null);
  if (!res) return "Réseau indisponible.";
  if (res.ok) return null;
  const data = (await res.json().catch(() => null)) as { error?: string } | null;
  return data?.error ?? `Envoi refusé (HTTP ${res.status}).`;
}

/* ---------------------------- État des serveurs ---------------------------- */

export function InhouseSetupStatus({ inference, training }: { inference: boolean; training: boolean }) {
  const line = (on: boolean, label: string, off: string) => (
    <li className="flex items-start gap-2">
      {on ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden /> : <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden />}
      <span>
        <span className="font-medium">{label} : </span>
        {on ? "configuré." : off}
      </span>
    </li>
  );
  return (
    <Card className="p-4">
      <ul className="space-y-1.5 text-sm">
        {line(
          training,
          "Serveur d'entraînement GPU",
          "non configuré (CALLPME_TRAINING_URL + CALLPME_TRAINING_SECRET). Les entraînements restent en file d'attente ; mode manuel possible.",
        )}
        {line(
          inference,
          "Serveur d'inférence (voix au téléphone)",
          "non configuré (CALLPME_TTS_URL). Écoute et publication impossibles ; les appels utilisent ElevenLabs.",
        )}
      </ul>
    </Card>
  );
}

/* ------------------------------ Nouvelle voix ------------------------------ */

export function NewInhouseVoiceForm() {
  const router = useRouter();
  const { pending, error, run } = useAction();
  const [form, setForm] = useState({ name: "", description: "", gender: "", accent: "" });
  return (
    <Section title="Nouvelle voix maison" description="Commencez par la voix ; le consentement signé du locuteur est demandé à l'étape suivante.">
      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          run(
            () =>
              createInhouseVoice({
                name: form.name,
                description: form.description,
                accent: form.accent,
                gender: (form.gender || null) as "feminine" | "masculine" | "neutral" | null,
              }),
            (r) => r.id && router.push(`/admin/voix-maison/${r.id}`),
          );
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="iv-name">Nom de la voix</Label>
          <Input id="iv-name" required minLength={2} maxLength={60} value={form.name} placeholder="ex. Awa" onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="iv-gender">Genre</Label>
          <Select id="iv-gender" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
            <option value="">Non précisé</option>
            <option value="feminine">Femme</option>
            <option value="masculine">Homme</option>
            <option value="neutral">Neutre</option>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="iv-accent">Accent</Label>
          <Input id="iv-accent" maxLength={60} value={form.accent} placeholder="ex. béninois" onChange={(e) => setForm({ ...form, accent: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="iv-desc">Description</Label>
          <Input id="iv-desc" maxLength={300} value={form.description} placeholder="ex. Chaleureuse, accueil téléphonique" onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
        <div className="sm:col-span-2 space-y-2">
          <ErrorLine text={error} />
          <Button type="submit" variant="brand" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" aria-hidden /> : <Plus aria-hidden />} Créer la voix
          </Button>
        </div>
      </form>
    </Section>
  );
}

/* ------------------------------ Consentement ------------------------------ */

export interface ConsentView {
  speakerName: string;
  speakerContact: string | null;
  formVersion: string;
  signedAt: string;
  documentName: string;
  revokedAt: string | null;
  revokeReason: string | null;
}

const day = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

export function ConsentSection({ voiceId, consent, formVersion }: { voiceId: string; consent: ConsentView | null; formVersion: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const revoke = useAction();
  const [reason, setReason] = useState("");

  if (consent) {
    return (
      <Section title="Consentement du locuteur">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {consent.revokedAt ? <Badge variant="danger">Révoqué le {day(consent.revokedAt)}</Badge> : <Badge variant="success">Signé et valide</Badge>}
          <span>
            {consent.speakerName}
            {consent.speakerContact ? ` · ${consent.speakerContact}` : ""} · signé le {day(consent.signedAt)} · formulaire {consent.formVersion}
          </span>
          <a className="text-brand underline-offset-2 hover:underline" href={`/api/admin/inhouse-voices/${voiceId}/consent/document`} target="_blank" rel="noopener">
            Voir le formulaire signé ({consent.documentName})
          </a>
        </div>
        {consent.revokedAt ? (
          <p className="text-sm text-muted-foreground">
            Motif : {consent.revokeReason}. Cette voix ne peut plus être enrichie, entraînée ni publiée. Supprimez ses clips si le locuteur le demande.
          </p>
        ) : (
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!confirm("Révoquer le consentement ? Les entraînements seront annulés et la voix retirée du catalogue.")) return;
              revoke.run(() => revokeInhouseConsent(voiceId, reason));
            }}
          >
            <div className="min-w-64 flex-1 space-y-1.5">
              <Label htmlFor="revoke-reason">Le locuteur retire son accord</Label>
              <Input id="revoke-reason" value={reason} maxLength={300} placeholder="Motif (ex. demande écrite du 12/11)" onChange={(e) => setReason(e.target.value)} />
            </div>
            <Button type="submit" variant="destructive" size="sm" disabled={revoke.pending}>
              Révoquer le consentement
            </Button>
            <div className="w-full">
              <ErrorLine text={revoke.error} />
            </div>
          </form>
        )}
      </Section>
    );
  }

  return (
    <Section
      title="Consentement signé (obligatoire)"
      description={`Faites signer au locuteur le formulaire de consentement ${formVersion} (modèle en annexe A de docs/voix-maison.md), puis déposez-le ici. Sans lui, aucun clip ne peut être ajouté.`}
    >
      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={async (e) => {
          e.preventDefault();
          setSending(true);
          setError(null);
          const err = await postForm(`/api/admin/inhouse-voices/${voiceId}/consent`, new FormData(e.currentTarget));
          setSending(false);
          if (err) setError(err);
          else router.refresh();
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="c-name">Nom complet du locuteur</Label>
          <Input id="c-name" name="speakerName" required minLength={3} maxLength={120} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="c-contact">Contact (téléphone ou e-mail)</Label>
          <Input id="c-contact" name="speakerContact" maxLength={160} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="c-date">Date de signature</Label>
          <Input id="c-date" name="signedAt" type="date" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="c-doc">Formulaire signé (PDF, JPEG ou PNG, 4 Mo max.)</Label>
          <Input id="c-doc" name="document" type="file" accept="application/pdf,image/jpeg,image/png" required />
        </div>
        <label className="flex items-start gap-2 text-sm sm:col-span-2">
          <input type="checkbox" name="attest" required className="mt-1" />
          <span>
            J&apos;atteste avoir vérifié l&apos;identité du locuteur et sa signature, et qu&apos;il accepte que sa voix soit enregistrée, utilisée pour entraîner un
            modèle Callpme et proposée aux clients au téléphone, avec le droit de retirer son accord à tout moment.
          </span>
        </label>
        <div className="space-y-2 sm:col-span-2">
          <ErrorLine text={error} />
          <Button type="submit" variant="brand" disabled={sending}>
            {sending && <Loader2 className="animate-spin" aria-hidden />} Enregistrer le consentement
          </Button>
        </div>
      </form>
    </Section>
  );
}

/* ------------------------------ Jeu de données ------------------------------ */

export interface ClipView {
  id: string;
  transcript: string;
  durationMs: number | null;
  source: string;
  sizeBytes: number;
  createdAt: string;
}

/** Enregistre au micro et convertit en WAV PCM 16 bits mono (format d'entraînement). */
function useRecorder() {
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const rec = useRef<MediaRecorder | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearInterval(timer.current);
      rec.current?.stream.getTracks().forEach((t) => t.stop());
    },
    [],
  );

  async function start(onDone: (wav: Blob, durationMs: number) => void) {
    setError(null);
    let stream: MediaStream;
    try {
      // Traitements désactivés : on veut la voix brute, pas débruitée par le navigateur.
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 } });
    } catch {
      setError("Micro inaccessible : autorisez-le dans le navigateur.");
      return;
    }
    const chunks: Blob[] = [];
    const r = new MediaRecorder(stream);
    r.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    r.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      if (timer.current) clearInterval(timer.current);
      setRecording(false);
      try {
        const ctx = new AudioContext();
        const decoded = await ctx.decodeAudioData(await new Blob(chunks).arrayBuffer());
        void ctx.close();
        const wav = pcm16ToWav(floatToPcm16(decoded.getChannelData(0)), decoded.sampleRate);
        onDone(new Blob([wav], { type: "audio/wav" }), Math.round(decoded.duration * 1000));
      } catch {
        setError("Enregistrement illisible, recommencez.");
      }
    };
    rec.current = r;
    r.start();
    setRecording(true);
    setElapsed(0);
    const t0 = Date.now();
    timer.current = setInterval(() => {
      const ms = Date.now() - t0;
      setElapsed(ms);
      if (ms >= CLIP_LIMITS.maxMs && r.state === "recording") r.stop();
    }, 200);
  }

  const stop = () => {
    if (rec.current?.state === "recording") rec.current.stop();
  };
  return { recording, elapsed, error, start, stop };
}

export function DatasetSection({
  voiceId,
  canAdd,
  speakerName,
  minimum,
  dataset,
  clips,
}: {
  voiceId: string;
  canAdd: boolean;
  speakerName: string | null;
  minimum: { clips: number; durationMs: number };
  dataset: { clips: number; durationMs: number };
  clips: ClipView[];
}) {
  const router = useRouter();
  const recorder = useRecorder();
  const del = useAction();
  const [transcript, setTranscript] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [recorded, setRecorded] = useState<{ blob: Blob; durationMs: number; url: string } | null>(null);
  const [attest, setAttest] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const fileInput = useRef<HTMLInputElement | null>(null);

  useEffect(
    () => () => {
      if (recorded) URL.revokeObjectURL(recorded.url);
    },
    [recorded],
  );

  const pct = Math.min(100, Math.round((dataset.durationMs / minimum.durationMs) * 100));

  async function send() {
    setError(null);
    const audio = recorded?.blob ?? file;
    if (!audio) return setError("Enregistrez ou choisissez un fichier audio.");
    const form = new FormData();
    form.set("audio", audio, recorded ? "enregistrement.wav" : (file?.name ?? "clip"));
    form.set("transcript", transcript);
    form.set("source", recorded ? "record" : "upload");
    if (recorded) form.set("durationMs", String(recorded.durationMs));
    else if (file) {
      // Durée mesurée par le navigateur pour les formats compressés (le serveur relit celle des WAV).
      const probe = URL.createObjectURL(file);
      const ms = await new Promise<number>((resolve) => {
        const a = new Audio(probe);
        a.onloadedmetadata = () => resolve(Number.isFinite(a.duration) ? Math.round(a.duration * 1000) : 0);
        a.onerror = () => resolve(0);
      });
      URL.revokeObjectURL(probe);
      form.set("durationMs", String(ms));
    }
    if (attest) form.set("attest", "on");
    setSending(true);
    const err = await postForm(`/api/admin/inhouse-voices/${voiceId}/clips`, form);
    setSending(false);
    if (err) return setError(err);
    setTranscript("");
    setFile(null);
    setRecorded(null);
    if (fileInput.current) fileInput.current.value = "";
    router.refresh();
  }

  return (
    <Section
      title="Jeu de données"
      description={`Clips de ${CLIP_LIMITS.minMs / 1000} à ${CLIP_LIMITS.maxMs / 1000} s, chacun avec sa transcription exacte, mot pour mot. Studio calme, même micro, même distance. Minimum technique : ${minimum.clips} clips et ${formatDuration(minimum.durationMs)} ; visez 1 à 3 h pour une qualité professionnelle.`}
    >
      <div className="space-y-1">
        <div className="flex justify-between text-sm">
          <span>
            {dataset.clips} clips · {formatDuration(dataset.durationMs)}
          </span>
          <span className="text-muted-foreground">{pct} % du minimum</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Progression du jeu de données">
          <div className="h-full bg-brand transition-[width]" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {canAdd ? (
        <div className="space-y-3 rounded-lg border border-border p-4">
          <div className="space-y-1.5">
            <Label htmlFor="clip-text">Transcription exacte du clip</Label>
            <Textarea id="clip-text" rows={2} maxLength={CLIP_LIMITS.transcriptMax} value={transcript} onChange={(e) => setTranscript(e.target.value)} placeholder="Phrase lue par le locuteur, mot pour mot." />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {recorder.recording ? (
              <Button type="button" variant="destructive" size="sm" onClick={recorder.stop}>
                <Square aria-hidden /> Arrêter ({Math.floor(recorder.elapsed / 1000)} s)
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  recorder.start((blob, durationMs) => {
                    setFile(null);
                    if (fileInput.current) fileInput.current.value = "";
                    setRecorded({ blob, durationMs, url: URL.createObjectURL(blob) });
                  })
                }
              >
                <Mic aria-hidden /> Enregistrer au micro
              </Button>
            )}
            <span className="text-xs text-muted-foreground">ou</span>
            <Input
              ref={fileInput}
              type="file"
              accept="audio/wav,audio/x-wav,audio/flac,audio/mpeg,audio/ogg,audio/webm"
              aria-label="Fichier audio du clip"
              className="max-w-xs"
              onChange={(e) => {
                setRecorded(null);
                setFile(e.target.files?.[0] ?? null);
              }}
            />
          </div>
          {recorded && (
            <div className="flex items-center gap-2 text-sm">
              <audio controls src={recorded.url} className="h-9" />
              <span className="text-muted-foreground">{formatDuration(recorded.durationMs)}</span>
            </div>
          )}
          <ErrorLine text={recorder.error ?? error} />
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={attest} onChange={(e) => setAttest(e.target.checked)} className="mt-1" />
            <span>J&apos;atteste que ce clip est la voix de {speakerName ?? "ce locuteur"}, enregistrée avec son consentement signé.</span>
          </label>
          <Button type="button" variant="brand" size="sm" disabled={sending || recorder.recording || !attest} onClick={send}>
            {sending ? <Loader2 className="animate-spin" aria-hidden /> : <Upload aria-hidden />} Ajouter le clip
          </Button>
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
          Ajout de clips impossible : le consentement signé du locuteur est absent ou révoqué.
        </p>
      )}

      <ErrorLine text={del.error} />
      {clips.length > 0 && (
        <ul className="divide-y divide-border">
          {clips.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-3 py-2">
              <audio controls preload="none" src={`/api/admin/inhouse-voices/clips/${c.id}`} className="h-9" aria-label={`Écouter : ${c.transcript}`} />
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm">{c.transcript}</p>
                <p className="text-xs text-muted-foreground">
                  {c.durationMs ? formatDuration(c.durationMs) : "—"} · {c.source === "record" ? "enregistré ici" : "fichier"} · {Math.round(c.sizeBytes / 1024)} Ko
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                aria-label="Supprimer ce clip"
                disabled={del.pending}
                onClick={() => confirm("Supprimer définitivement ce clip ?") && del.run(() => deleteInhouseClip(c.id))}
              >
                <Trash2 aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

/* ------------------------------ Entraînement ------------------------------ */

export interface JobView {
  id: string;
  status: string;
  baseModel: string;
  clipCount: number;
  totalDurationMs: number;
  progress: number | null;
  message: string | null;
  createdAt: string;
  finishedAt: string | null;
}

const JOB_LABEL: Record<string, { label: string; variant: "muted" | "warning" | "brand" | "success" | "danger" | "outline" }> = {
  queued: { label: "En attente", variant: "warning" },
  submitted: { label: "Envoyé au GPU", variant: "brand" },
  running: { label: "En cours", variant: "brand" },
  succeeded: { label: "Réussi", variant: "success" },
  failed: { label: "Échec", variant: "danger" },
  canceled: { label: "Annulé", variant: "muted" },
};

export function TrainingSection({
  voiceId,
  baseModels,
  blocker,
  inference,
  jobs,
}: {
  voiceId: string;
  baseModels: { id: string; label: string }[];
  blocker: string | null;
  inference: boolean;
  jobs: JobView[];
}) {
  const { pending, error, run } = useAction();
  const [model, setModel] = useState(baseModels[0]?.id ?? "");
  const active = (s: string) => s === "queued" || s === "submitted" || s === "running";

  return (
    <Section title="Entraînement" description="L'affinage (fine-tuning) du modèle de base sur ce jeu de données, exécuté sur notre serveur GPU.">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-72 space-y-1.5">
          <Label htmlFor="base-model">Modèle de base</Label>
          <Select id="base-model" value={model} onChange={(e) => setModel(e.target.value)}>
            {baseModels.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </Select>
        </div>
        <Button variant="brand" disabled={pending || Boolean(blocker)} onClick={() => run(() => startInhouseTraining(voiceId, model))}>
          {pending && <Loader2 className="animate-spin" aria-hidden />} Lancer l&apos;entraînement
        </Button>
      </div>
      {blocker && <p className="text-sm text-muted-foreground">{blocker}</p>}
      <ErrorLine text={error} />
      {jobs.length > 0 && (
        <ul className="divide-y divide-border">
          {jobs.map((j) => {
            const s = JOB_LABEL[j.status] ?? { label: j.status, variant: "outline" as const };
            return (
              <li key={j.id} className="space-y-2 py-3">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <Badge variant={s.variant}>{s.label}</Badge>
                  <span>{j.baseModel}</span>
                  <span className="text-muted-foreground">
                    · {j.clipCount} clips · {formatDuration(j.totalDurationMs)} · lancé le {day(j.createdAt)}
                    {j.progress !== null && active(j.status) ? ` · ${j.progress} %` : ""}
                  </span>
                </div>
                {j.message && <p className="text-xs text-muted-foreground">{j.message}</p>}
                {active(j.status) && (
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" disabled={pending} onClick={() => confirm("Annuler cet entraînement ?") && run(() => cancelInhouseTraining(j.id))}>
                      Annuler
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={pending || !inference}
                      title={inference ? undefined : "Serveur d'inférence requis pour vérifier le modèle."}
                      onClick={() => run(() => confirmInhouseTrainingDone(j.id))}
                    >
                      Mode manuel : le modèle cpm_{j.id} est déployé
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}

/* -------------------------------- Versions -------------------------------- */

export interface VersionView {
  id: string;
  number: number;
  modelRef: string;
  status: string;
  notes: string | null;
  publishedAt: string | null;
}

function VersionRow({ v, inference, canPublish }: { v: VersionView; inference: boolean; canPublish: boolean }) {
  const { pending, error, setError, run } = useAction();
  const [text, setText] = useState(SAMPLE_TEXT);
  const [listening, setListening] = useState(false);
  const [url, setUrl] = useState<string | null>(null);

  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );

  async function listen() {
    setError(null);
    setListening(true);
    const res = await fetch(`/api/admin/inhouse-voices/versions/${v.id}/preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    }).catch(() => null);
    setListening(false);
    if (!res?.ok) {
      const data = (await res?.json().catch(() => null)) as { error?: string } | null;
      return setError(data?.error ?? "Écoute impossible.");
    }
    setUrl(URL.createObjectURL(await res.blob()));
  }

  return (
    <li className="space-y-3 py-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium">Version {v.number}</span>
        {v.status === "published" && <Badge variant="success">Publiée au catalogue</Badge>}
        {v.status === "draft" && <Badge variant="warning">Brouillon</Badge>}
        {v.status === "retired" && <Badge variant="muted">Retirée</Badge>}
        <code className="text-xs text-muted-foreground">{v.modelRef}</code>
        {v.notes && <span className="text-xs text-muted-foreground">· {v.notes}</span>}
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-64 flex-1 space-y-1.5">
          <Label htmlFor={`t-${v.id}`}>Texte d&apos;écoute (rendu téléphone, 8 kHz)</Label>
          <Input id={`t-${v.id}`} value={text} maxLength={400} onChange={(e) => setText(e.target.value)} />
        </div>
        <Button variant="outline" size="sm" disabled={!inference || listening} onClick={listen}>
          {listening && <Loader2 className="animate-spin" aria-hidden />} Écouter
        </Button>
        {v.status !== "published" && (
          <Button
            variant="brand"
            size="sm"
            disabled={pending || !inference || !canPublish}
            onClick={() => confirm("Publier cette version au catalogue des clients ?") && run(() => publishInhouseVersion(v.id))}
          >
            Publier au catalogue
          </Button>
        )}
        {v.status === "published" && (
          <Button variant="outline" size="sm" disabled={pending} onClick={() => confirm("Retirer cette version du catalogue ?") && run(() => retireInhouseVersion(v.id))}>
            Retirer
          </Button>
        )}
      </div>
      {url && <audio controls autoPlay src={url} className="h-9" />}
      <ErrorLine text={error} />
    </li>
  );
}

export function VersionsSection({ versions, inference, canPublish }: { versions: VersionView[]; inference: boolean; canPublish: boolean }) {
  return (
    <Section
      title="Versions du modèle"
      description="Chaque entraînement réussi produit une version. Écoutez-la, puis publiez-la : elle rejoint le catalogue des voix proposé aux clients."
    >
      {versions.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucune version : lancez un entraînement.</p>
      ) : (
        <ul className="divide-y divide-border">
          {versions.map((v) => (
            <VersionRow key={v.id} v={v} inference={inference} canPublish={canPublish} />
          ))}
        </ul>
      )}
    </Section>
  );
}
