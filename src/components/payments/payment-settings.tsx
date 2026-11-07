"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, Copy, Loader2, Trash2 } from "lucide-react";
import { removePaymentSettings, savePaymentSettings, setPaymentsEnabled } from "@/app/actions/payments";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

export interface PaymentSettingsView {
  enabled: boolean;
  currency: "XOF" | "EUR";
  maxAmount: number;
  allowCustomAmount: boolean;
  delivery: "sms" | "whatsapp";
  itemsText: string;
  /** Réservé aux administrateurs. */
  webhookUrl: string;
  sandbox: boolean;
}

export function PaymentSettings({
  canEdit,
  settings,
  whatsappConnected,
}: {
  canEdit: boolean;
  settings: PaymentSettingsView | null;
  whatsappConnected: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [form, setForm] = useState({
    apiKey: "",
    apiSecret: "",
    webhookSecret: "",
    currency: settings?.currency ?? "XOF",
    maxAmount: String(settings?.maxAmount ?? 50000),
    allowCustomAmount: settings?.allowCustomAmount ?? false,
    delivery: settings?.delivery ?? "sms",
    items: settings?.itemsText ?? "",
  });

  function run(action: () => Promise<{ error?: string }>, okText: string) {
    setMsg(null);
    start(async () => {
      const r = await action();
      setMsg(r.error ? { ok: false, text: r.error } : { ok: true, text: okText });
      if (!r.error) {
        setForm((f) => ({ ...f, apiKey: "", apiSecret: "", webhookSecret: "" }));
        router.refresh();
      }
    });
  }

  const unit = form.currency === "EUR" ? "€" : "FCFA";

  return (
    <div className="space-y-5">
      {settings && (
        <div className="flex flex-wrap items-center gap-3">
          {settings.enabled ? <Badge variant="success">Encaissement actif</Badge> : <Badge variant="muted">En pause</Badge>}
          {settings.sandbox && <Badge variant="warning">Clés de test (sandbox)</Badge>}
          {canEdit && (
            <label className="ml-auto flex items-center gap-2 text-sm">
              <Switch
                checked={settings.enabled}
                onCheckedChange={(v) => run(() => setPaymentsEnabled(v), v ? "Encaissement activé." : "Encaissement en pause.")}
                aria-label="Encaissement par les agents"
              />
              Les agents peuvent encaisser
            </label>
          )}
        </div>
      )}

      {canEdit && settings?.webhookUrl && (
        <div className="space-y-2 rounded-xl border border-border bg-secondary/30 p-4">
          <Label htmlFor="pay-webhook">URL du webhook, à coller dans votre tableau de bord GeniusPay</Label>
          <div className="flex gap-2">
            <Input id="pay-webhook" readOnly value={settings.webhookUrl} className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
            <Button
              type="button"
              variant="outline"
              aria-label="Copier l'URL du webhook"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(settings.webhookUrl);
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
          <p className="text-xs text-muted-foreground">
            Abonnez-le aux événements de paiement. Le statut est confirmé dès sa réception (et vérifié auprès de GeniusPay).
          </p>
        </div>
      )}

      {canEdit ? (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData();
            fd.set("apiKey", form.apiKey);
            fd.set("apiSecret", form.apiSecret);
            fd.set("webhookSecret", form.webhookSecret);
            fd.set("currency", form.currency);
            fd.set("maxAmount", form.maxAmount);
            fd.set("allowCustomAmount", form.allowCustomAmount ? "on" : "off");
            fd.set("delivery", form.delivery);
            fd.set("items", form.items);
            run(() => savePaymentSettings(fd), settings ? "Réglages enregistrés." : "Compte GeniusPay relié. Copiez maintenant l'URL du webhook chez GeniusPay.");
          }}
        >
          <fieldset className="grid gap-4 sm:grid-cols-3">
            <legend className="mb-2 text-sm font-medium">Clés de votre compte marchand GeniusPay</legend>
            <div className="space-y-1.5">
              <Label htmlFor="pay-key">Clé publique</Label>
              <Input
                id="pay-key"
                type="password"
                autoComplete="off"
                spellCheck={false}
                value={form.apiKey}
                onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
                placeholder={settings ? "Laisser vide pour garder l'actuelle" : "pk_…"}
                required={!settings}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pay-secret">Clé secrète</Label>
              <Input
                id="pay-secret"
                type="password"
                autoComplete="off"
                spellCheck={false}
                value={form.apiSecret}
                onChange={(e) => setForm({ ...form, apiSecret: e.target.value })}
                placeholder={settings ? "Laisser vide pour garder l'actuelle" : "sk_…"}
                required={!settings}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pay-whsec">Secret du webhook</Label>
              <Input
                id="pay-whsec"
                type="password"
                autoComplete="off"
                spellCheck={false}
                value={form.webhookSecret}
                onChange={(e) => setForm({ ...form, webhookSecret: e.target.value })}
                placeholder={settings ? "Laisser vide pour garder l'actuel" : "Secret de signature"}
                required={!settings}
              />
            </div>
          </fieldset>
          <p className="text-xs text-muted-foreground">
            Les clés sont chiffrées dès réception et ne sont plus jamais affichées. Les paiements arrivent directement sur votre compte
            GeniusPay ; Callpme ne reçoit ni l&apos;argent ni les données de paiement de vos clients.
          </p>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="pay-currency">Devise des montants</Label>
              <Select id="pay-currency" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value === "EUR" ? "EUR" : "XOF" })}>
                <option value="XOF">FCFA (XOF)</option>
                <option value="EUR">Euro (converti en FCFA)</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pay-max">Plafond par demande ({unit})</Label>
              <Input
                id="pay-max"
                inputMode="numeric"
                value={form.maxAmount}
                onChange={(e) => setForm({ ...form, maxAmount: e.target.value.replace(/[^\d]/g, "") })}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pay-delivery">Envoi du lien</Label>
              <Select id="pay-delivery" value={form.delivery} onChange={(e) => setForm({ ...form, delivery: e.target.value === "whatsapp" ? "whatsapp" : "sms" })}>
                <option value="sms">SMS</option>
                <option value="whatsapp" disabled={!whatsappConnected}>
                  WhatsApp (repli SMS){whatsappConnected ? "" : " — non connecté"}
                </option>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pay-items">Vos tarifs (une prestation par ligne)</Label>
            <Textarea
              id="pay-items"
              rows={5}
              value={form.items}
              onChange={(e) => setForm({ ...form, items: e.target.value })}
              placeholder={form.currency === "EUR" ? "Consultation = 25\nAcompte livraison = 10,50" : "Consultation = 5000\nFrais de scolarité (1er trimestre) = 75000"}
              aria-describedby="pay-items-help"
            />
            <p id="pay-items-help" className="text-xs text-muted-foreground">
              L&apos;agent annonce le tarif et l&apos;encaisse tel quel : il ne peut pas l&apos;inventer ni le modifier.
            </p>
          </div>

          <label className="flex items-start gap-3 text-sm">
            <Switch
              checked={form.allowCustomAmount}
              onCheckedChange={(v) => setForm({ ...form, allowCustomAmount: v })}
              aria-label="Autoriser les montants libres"
            />
            <span>
              Autoriser les montants libres
              <span className="block text-xs text-muted-foreground">
                L&apos;agent peut encaisser un montant énoncé pendant l&apos;appel, dans la limite du plafond.
              </span>
            </span>
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" variant="brand" disabled={pending}>
              {pending && <Loader2 className="animate-spin" aria-hidden />} {settings ? "Enregistrer" : "Relier mon compte GeniusPay"}
            </Button>
            {settings && (
              <Button
                type="button"
                variant="ghost"
                className="text-destructive hover:text-destructive"
                disabled={pending}
                onClick={() => {
                  if (window.confirm("Supprimer vos clés GeniusPay ? Les agents ne pourront plus encaisser.")) run(removePaymentSettings, "Clés supprimées.");
                }}
              >
                <Trash2 aria-hidden /> Supprimer les clés
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
        <p className="text-sm text-muted-foreground">Un administrateur de l&apos;organisation peut relier le compte GeniusPay.</p>
      )}
    </div>
  );
}
