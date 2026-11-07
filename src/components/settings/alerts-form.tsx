"use client";

import { useState, useTransition } from "react";
import { AlertCircle, Check, Loader2 } from "lucide-react";
import { saveAlertSettings } from "@/app/actions/settings";
import { ALERT_EVENTS, type AlertSettings } from "@/lib/alerts/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

const TIME_ZONES: [string, string][] = [
  ["", "Fuseau du pays de l'organisation"],
  ["Africa/Porto-Novo", "Bénin (Porto-Novo)"],
  ["Africa/Lome", "Togo (Lomé)"],
  ["Africa/Abidjan", "Côte d'Ivoire (Abidjan)"],
  ["Africa/Dakar", "Sénégal (Dakar)"],
  ["Africa/Bamako", "Mali (Bamako)"],
  ["Africa/Ouagadougou", "Burkina Faso (Ouagadougou)"],
  ["Africa/Niamey", "Niger (Niamey)"],
  ["Africa/Lagos", "Nigeria (Lagos)"],
  ["Africa/Accra", "Ghana (Accra)"],
  ["Africa/Douala", "Cameroun (Douala)"],
  ["Europe/Paris", "France (Paris)"],
];

const splitList = (v: string) => v.split(/[\s,;]+/).map((r) => r.trim()).filter(Boolean);

export function AlertsForm({ initial, canEdit, hasWhatsApp = false }: { initial: AlertSettings; canEdit: boolean; hasWhatsApp?: boolean }) {
  const [s, setS] = useState<AlertSettings>(initial);
  const [recipients, setRecipients] = useState(initial.recipients.join("\n"));
  const [waTo, setWaTo] = useState(initial.digest.whatsappTo.join("\n"));
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const d = s.digest;
  const setDigest = (patch: Partial<AlertSettings["digest"]>) => setS({ ...s, digest: { ...d, ...patch } });
  const digestOff = !canEdit || !d.enabled;

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setMsg(null);
        start(async () => {
          const r = await saveAlertSettings({
            ...s,
            recipients: splitList(recipients),
            digest: { ...d, whatsappTo: splitList(waTo).map((n) => n.replace(/^00/, "+")) },
          });
          setMsg(r.error ? { ok: false, text: r.error } : { ok: true, text: "Alertes enregistrées." });
        });
      }}
    >
      <label className="flex items-center gap-3 text-sm">
        <Switch checked={s.email} disabled={!canEdit} onCheckedChange={(v) => setS({ ...s, email: v })} aria-label="Recevoir les alertes par e-mail" />
        <span className="font-medium">Recevoir les alertes par e-mail</span>
      </label>
      <fieldset className="space-y-2" disabled={!canEdit || !s.email}>
        <legend className="text-sm font-medium">Me prévenir quand…</legend>
        {ALERT_EVENTS.map((ev) => (
          <label key={ev.id} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-[hsl(var(--brand))]"
              checked={s.events.includes(ev.id)}
              onChange={(e) =>
                setS({ ...s, events: e.target.checked ? [...s.events, ev.id] : s.events.filter((x) => x !== ev.id) })
              }
            />
            {ev.label}
          </label>
        ))}
      </fieldset>
      <div className="space-y-1.5">
        <Label htmlFor="alert-recipients">Destinataires (facultatif)</Label>
        <Textarea
          id="alert-recipients"
          rows={2}
          disabled={!canEdit}
          value={recipients}
          onChange={(e) => setRecipients(e.target.value)}
          placeholder="accueil@monentreprise.bj"
          aria-describedby="alert-recipients-help"
        />
        <p id="alert-recipients-help" className="text-xs text-muted-foreground">
          Une adresse par ligne (5 au plus). Vide : le propriétaire et les administrateurs reçoivent les alertes et le résumé.
        </p>
      </div>

      <fieldset className="space-y-3 rounded-lg border border-border p-4">
        <legend className="px-1 text-sm font-medium">Résumé quotidien</legend>
        <label className="flex items-center gap-3 text-sm">
          <Switch
            checked={d.enabled}
            disabled={!canEdit}
            onCheckedChange={(v) => setDigest({ enabled: v })}
            aria-label="Recevoir chaque soir le résumé de la journée"
          />
          <span>Recevoir chaque soir le résumé de la journée</span>
        </label>
        <p className="text-xs text-muted-foreground">
          Appels reçus et manqués, appelants rappelés, rendez-vous, fiches clients et urgences à rappeler. Rien n&apos;est envoyé les jours sans
          activité.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="digest-hour">Heure d&apos;envoi</Label>
            <select
              id="digest-hour"
              className="flex h-10 w-full rounded-lg border border-input bg-card px-3 text-sm disabled:opacity-50"
              disabled={digestOff}
              value={d.hour}
              onChange={(e) => setDigest({ hour: Number(e.target.value) })}
            >
              {Array.from({ length: 24 }, (_, h) => (
                <option key={h} value={h}>
                  {String(h).padStart(2, "0")} h 00
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="digest-tz">Fuseau horaire</Label>
            <select
              id="digest-tz"
              className="flex h-10 w-full rounded-lg border border-input bg-card px-3 text-sm disabled:opacity-50"
              disabled={digestOff}
              value={d.timeZone}
              onChange={(e) => setDigest({ timeZone: e.target.value })}
            >
              {(TIME_ZONES.some(([v]) => v === d.timeZone) ? TIME_ZONES : [...TIME_ZONES, [d.timeZone, d.timeZone] as [string, string]]).map(
                ([v, label]) => (
                  <option key={v} value={v}>
                    {label}
                  </option>
                ),
              )}
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="digest-wa-to">Numéros WhatsApp du gérant (facultatif)</Label>
          <Textarea
            id="digest-wa-to"
            rows={2}
            disabled={digestOff}
            value={waTo}
            onChange={(e) => setWaTo(e.target.value)}
            placeholder="+2290197123456"
            aria-describedby="digest-wa-help"
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_8rem]">
          <div className="space-y-1.5">
            <Label htmlFor="digest-wa-template">Modèle de message WhatsApp approuvé</Label>
            <Input
              id="digest-wa-template"
              disabled={digestOff}
              value={d.whatsappTemplate}
              onChange={(e) => setDigest({ whatsappTemplate: e.target.value.trim().toLowerCase() })}
              placeholder="resume_quotidien"
              aria-describedby="digest-wa-help"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="digest-wa-lang">Langue</Label>
            <Input
              id="digest-wa-lang"
              disabled={digestOff}
              value={d.whatsappLanguage}
              onChange={(e) => setDigest({ whatsappLanguage: e.target.value.trim() })}
              placeholder="fr"
            />
          </div>
        </div>
        <p id="digest-wa-help" className="text-xs text-muted-foreground">
          {hasWhatsApp
            ? "Le résumé part sur WhatsApp depuis votre canal connecté. Meta exige un modèle de message approuvé dont le corps contient un seul paramètre {{1}} (le résumé). Sans modèle, ou si l'envoi échoue, le résumé part par e-mail."
            : "Connectez un canal WhatsApp (menu Canaux) pour recevoir le résumé sur WhatsApp. En attendant, il part par e-mail."}
        </p>
      </fieldset>

      {canEdit && (
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" variant="brand" size="sm" disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" aria-hidden />} Enregistrer
          </Button>
          {msg && (
            <p role={msg.ok ? "status" : "alert"} className={msg.ok ? "flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400" : "flex items-center gap-1.5 text-sm text-destructive"}>
              {msg.ok ? <Check className="size-4" aria-hidden /> : <AlertCircle className="size-4" aria-hidden />} {msg.text}
            </p>
          )}
        </div>
      )}
    </form>
  );
}
