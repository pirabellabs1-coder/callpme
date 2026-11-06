"use client";

import { useState, useTransition } from "react";
import { AlertCircle, Check, Loader2 } from "lucide-react";
import { saveAlertSettings } from "@/app/actions/settings";
import { ALERT_EVENTS, type AlertSettings } from "@/lib/alerts/settings";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

export function AlertsForm({ initial, canEdit }: { initial: AlertSettings; canEdit: boolean }) {
  const [s, setS] = useState<AlertSettings>(initial);
  const [recipients, setRecipients] = useState(initial.recipients.join("\n"));
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setMsg(null);
        const list = recipients.split(/[\s,;]+/).map((r) => r.trim()).filter(Boolean);
        start(async () => {
          const r = await saveAlertSettings({ ...s, recipients: list });
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
          disabled={!canEdit || !s.email}
          value={recipients}
          onChange={(e) => setRecipients(e.target.value)}
          placeholder="accueil@monentreprise.bj"
          aria-describedby="alert-recipients-help"
        />
        <p id="alert-recipients-help" className="text-xs text-muted-foreground">
          Une adresse par ligne (5 au plus). Vide : le propriétaire et les administrateurs reçoivent les alertes.
        </p>
      </div>
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
