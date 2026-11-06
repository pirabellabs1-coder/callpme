"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, Copy, Loader2, Unplug } from "lucide-react";
import { removeWhatsAppChannel, saveWhatsAppChannel, setWhatsAppEnabled } from "@/app/actions/channels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

interface ChannelView {
  agentId: string;
  phoneNumberId: string;
  displayNumber: string | null;
  enabled: boolean;
  webhookUrl: string;
  verifyToken: string;
}

function CopyField({ id, label, value }: { id: string; label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex gap-2">
        <Input id={id} readOnly value={value} className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
        <Button
          type="button"
          variant="outline"
          aria-label={`Copier : ${label}`}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            } catch {
              setCopied(false);
            }
          }}
        >
          {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
        </Button>
      </div>
    </div>
  );
}

export function WhatsAppSettings({
  canEdit,
  agents,
  channel,
}: {
  canEdit: boolean;
  agents: { id: string; name: string; status: string }[];
  channel: ChannelView | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [form, setForm] = useState({
    agentId: channel?.agentId ?? agents[0]?.id ?? "",
    phoneNumberId: channel?.phoneNumberId ?? "",
    accessToken: "",
    appSecret: "",
  });
  const selectedAgent = agents.find((a) => a.id === form.agentId);

  function run(action: () => Promise<{ error?: string }>, okText: string) {
    setMsg(null);
    start(async () => {
      const r = await action();
      setMsg(r.error ? { ok: false, text: r.error } : { ok: true, text: okText });
      if (!r.error) {
        setForm((f) => ({ ...f, accessToken: "", appSecret: "" }));
        router.refresh();
      }
    });
  }

  if (agents.length === 0) {
    return <p className="text-sm text-muted-foreground">Créez d&apos;abord un agent : c&apos;est lui qui répondra sur WhatsApp.</p>;
  }

  return (
    <div className="space-y-5">
      {channel && (
        <div className="flex flex-wrap items-center gap-3">
          {channel.enabled ? <Badge variant="success">Connecté</Badge> : <Badge variant="muted">En pause</Badge>}
          <span className="text-sm">
            {channel.displayNumber ? <span className="mono">{channel.displayNumber}</span> : "Numéro WhatsApp"} · répond avec{" "}
            {agents.find((a) => a.id === channel.agentId)?.name ?? "un agent supprimé"}
          </span>
          {canEdit && (
            <label className="ml-auto flex items-center gap-2 text-sm">
              <Switch
                checked={channel.enabled}
                onCheckedChange={(v) => run(() => setWhatsAppEnabled(v), v ? "Réponses activées." : "Réponses en pause.")}
                aria-label="Réponses automatiques sur WhatsApp"
              />
              Réponses automatiques
            </label>
          )}
        </div>
      )}

      {canEdit && channel && (
        <div className="space-y-3 rounded-xl border border-border bg-secondary/30 p-4">
          <p className="text-sm font-medium">À renseigner chez Meta (WhatsApp › Configuration › Webhook)</p>
          <CopyField id="wa-webhook" label="URL de rappel (Callback URL)" value={channel.webhookUrl} />
          <CopyField id="wa-verify" label="Jeton de vérification (Verify token)" value={channel.verifyToken} />
          <p className="text-xs text-muted-foreground">Puis abonnez le webhook au champ « messages ».</p>
        </div>
      )}

      {canEdit ? (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData();
            Object.entries(form).forEach(([k, v]) => fd.set(k, v));
            run(() => saveWhatsAppChannel(fd), channel ? "Réglages enregistrés." : "WhatsApp connecté. Renseignez maintenant le webhook chez Meta.");
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="wa-agent">Agent qui répond</Label>
              <Select id="wa-agent" value={form.agentId} onChange={(e) => setForm({ ...form, agentId: e.target.value })}>
                {agents.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                    {a.status !== "active" ? " (hors ligne)" : ""}
                  </option>
                ))}
              </Select>
              {selectedAgent && selectedAgent.status !== "active" && (
                <p className="text-xs text-amber-700 dark:text-amber-400">Cet agent doit être « En ligne » pour répondre.</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wa-phone-id">Phone number ID</Label>
              <Input
                id="wa-phone-id"
                inputMode="numeric"
                value={form.phoneNumberId}
                onChange={(e) => setForm({ ...form, phoneNumberId: e.target.value.trim() })}
                placeholder="123456789012345"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wa-token">Jeton d&apos;accès permanent</Label>
              <Input
                id="wa-token"
                type="password"
                autoComplete="off"
                value={form.accessToken}
                onChange={(e) => setForm({ ...form, accessToken: e.target.value })}
                placeholder={channel ? "Laisser vide pour garder l'actuel" : "EAAG…"}
                required={!channel}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wa-secret">Secret de l&apos;application Meta</Label>
              <Input
                id="wa-secret"
                type="password"
                autoComplete="off"
                value={form.appSecret}
                onChange={(e) => setForm({ ...form, appSecret: e.target.value })}
                placeholder={channel ? "Laisser vide pour garder l'actuel" : "32 caractères"}
                required={!channel}
              />
            </div>
          </div>
          <details className="text-sm text-muted-foreground">
            <summary className="cursor-pointer font-medium text-foreground">Où trouver ces informations ?</summary>
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              <li>Sur developers.facebook.com, créez une application de type « Business » et ajoutez le produit WhatsApp.</li>
              <li>Dans WhatsApp › Configuration de l&apos;API : copiez le « Phone number ID » de votre numéro.</li>
              <li>Dans Business Manager › Utilisateurs système : générez un jeton permanent avec l&apos;autorisation whatsapp_business_messaging.</li>
              <li>Dans Paramètres de l&apos;application › De base : copiez le « Secret de l&apos;application ».</li>
            </ol>
          </details>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" variant="brand" disabled={pending}>
              {pending && <Loader2 className="animate-spin" aria-hidden />} {channel ? "Enregistrer" : "Connecter WhatsApp"}
            </Button>
            {channel && (
              <Button
                type="button"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                disabled={pending}
                onClick={() => {
                  if (window.confirm("Déconnecter WhatsApp ? L'agent ne répondra plus aux messages.")) run(removeWhatsAppChannel, "WhatsApp déconnecté.");
                }}
              >
                <Unplug aria-hidden /> Déconnecter
              </Button>
            )}
            {msg && (
              <p
                role={msg.ok ? "status" : "alert"}
                className={msg.ok ? "flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400" : "flex items-center gap-1.5 text-sm text-destructive"}
              >
                {msg.ok ? <Check className="size-4" aria-hidden /> : <AlertCircle className="size-4" aria-hidden />} {msg.text}
              </p>
            )}
          </div>
        </form>
      ) : (
        !channel && <p className="text-sm text-muted-foreground">Un administrateur de l&apos;organisation peut connecter WhatsApp.</p>
      )}
    </div>
  );
}
