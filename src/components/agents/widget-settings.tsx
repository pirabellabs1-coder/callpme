"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Check, Copy, Globe, Loader2, Play, Save } from "lucide-react";
import type { WidgetConfig } from "@/lib/shared/types";
import { normalizeDomain, widgetSnippet } from "@/lib/widget/widget";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

export function WidgetSettings({
  agentId,
  agentActive,
  appUrl,
  initial,
}: {
  agentId: string;
  agentActive: boolean;
  appUrl: string;
  initial: WidgetConfig;
}) {
  const [w, setW] = useState<WidgetConfig>(initial);
  const [domainsText, setDomainsText] = useState(initial.allowedDomains.join("\n"));
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [preview, setPreview] = useState(false);
  const snippet = widgetSnippet(appUrl, agentId);

  const domains = domainsText
    .split(/[\s,;]+/)
    .map((d) => d.trim())
    .filter(Boolean);
  const invalid = domains.filter((d) => !normalizeDomain(d));

  // Aperçu : le vrai script chargé sur cette page (autorisé pour vous, même widget désactivé).
  useEffect(() => {
    if (!preview) return;
    const s = document.createElement("script");
    s.src = `/widget.js?v=${Date.now()}`;
    s.setAttribute("data-agent", agentId);
    s.async = true;
    document.body.appendChild(s);
    return () => {
      s.remove();
      document.querySelector("[data-callpme]")?.remove();
      (window as unknown as { __callpmeWidget?: boolean }).__callpmeWidget = false;
    };
  }, [preview, agentId]);

  async function save() {
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch(`/api/agents/${agentId}/widget`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ widget: { ...w, allowedDomains: domains } }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus({ tone: "error", text: data.error ?? "Enregistrement impossible." });
        return;
      }
      setW(data.widget);
      setDomainsText((data.widget.allowedDomains as string[]).join("\n"));
      setStatus({ tone: "ok", text: "Réglages enregistrés." });
    } catch {
      setStatus({ tone: "error", text: "Connexion impossible. Réessayez." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="space-y-5 p-5">
        <label className="flex items-center gap-3 text-sm">
          <Switch checked={w.enabled} onCheckedChange={(v) => setW({ ...w, enabled: v })} aria-label="Activer le bouton sur le site" />
          <span>
            <span className="font-medium">{w.enabled ? "Bouton activé" : "Bouton désactivé"}</span>
            <span className="block text-xs text-muted-foreground">
              {w.enabled ? "Il s'affiche sur les sites listés ci-dessous." : "Le code reste en place mais rien ne s'affiche."}
            </span>
          </span>
        </label>
        {w.enabled && !agentActive && (
          <p className="flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
            <AlertCircle className="size-4 shrink-0" aria-hidden /> L&apos;agent n&apos;est pas « En ligne » : le bouton ne s&apos;affichera pas
            avant sa mise en ligne.
          </p>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="widget-domains">Sites autorisés</Label>
          <Textarea
            id="widget-domains"
            rows={3}
            value={domainsText}
            onChange={(e) => setDomainsText(e.target.value)}
            placeholder={"monsite.bj\nwww.monentreprise.com"}
            aria-describedby="widget-domains-help"
            aria-invalid={invalid.length > 0}
          />
          <p id="widget-domains-help" className="text-xs text-muted-foreground">
            Un domaine par ligne. « monsite.bj » autorise aussi « www.monsite.bj ». Le bouton ne fonctionne nulle part ailleurs.
          </p>
          {invalid.length > 0 && <p className="text-xs text-destructive">Domaine invalide : {invalid.join(", ")}</p>}
        </div>

        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
          <div className="space-y-1.5">
            <Label htmlFor="widget-label">Texte du bouton</Label>
            <Input id="widget-label" maxLength={40} value={w.label ?? ""} onChange={(e) => setW({ ...w, label: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="widget-color">Couleur</Label>
            <input
              id="widget-color"
              type="color"
              value={w.color ?? "#E8572A"}
              onChange={(e) => setW({ ...w, color: e.target.value })}
              className="h-10 w-14 cursor-pointer rounded-lg border border-input bg-card p-1"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="widget-position">Position</Label>
            <Select id="widget-position" value={w.position ?? "right"} onChange={(e) => setW({ ...w, position: e.target.value as "right" | "left" })}>
              <option value="right">En bas à droite</option>
              <option value="left">En bas à gauche</option>
            </Select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="brand" onClick={save} disabled={saving || invalid.length > 0}>
            {saving ? <Loader2 className="animate-spin" aria-hidden /> : <Save aria-hidden />} Enregistrer
          </Button>
          <Button variant="outline" onClick={() => setPreview((v) => !v)} aria-pressed={preview}>
            <Play aria-hidden /> {preview ? "Retirer l'aperçu" : "Essayer ici"}
          </Button>
          <p aria-live="polite" className={status?.tone === "error" ? "text-sm text-destructive" : "text-sm text-emerald-600 dark:text-emerald-400"}>
            {status?.text}
          </p>
        </div>
        {preview && (
          <p className="text-xs text-muted-foreground">
            Le bouton est affiché en bas de cette page avec les réglages enregistrés. L&apos;aperçu est une conversation de test :
            les outils (réservation, SMS…) n&apos;ont pas d&apos;effet.
          </p>
        )}
      </Card>

      <Card className="space-y-4 p-5">
        <div className="flex items-center gap-2">
          <Globe className="size-4 text-muted-foreground" aria-hidden />
          <h3 className="text-sm font-semibold">Code à copier sur votre site</h3>
        </div>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
          <li>Indiquez vos sites autorisés, activez le bouton et enregistrez.</li>
          <li>Copiez ce code et collez-le juste avant &lt;/body&gt; sur chaque page (ou dans l&apos;outil « code personnalisé » de WordPress, Wix, Shopify…).</li>
          <li>Votre site doit être en https : le navigateur l&apos;exige pour utiliser le micro.</li>
        </ol>
        <pre className="overflow-x-auto rounded-lg bg-secondary p-3 text-xs">
          <code>{snippet}</code>
        </pre>
        <Button
          variant="outline"
          size="sm"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(snippet);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            } catch {
              setCopied(false);
            }
          }}
        >
          {copied ? <Check aria-hidden /> : <Copy aria-hidden />} {copied ? "Copié" : "Copier le code"}
        </Button>
      </Card>
    </div>
  );
}
