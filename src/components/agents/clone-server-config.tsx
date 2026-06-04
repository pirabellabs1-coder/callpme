"use client";

import { useEffect, useState } from "react";
import { Loader2, CheckCircle2, XCircle, Server, ExternalLink } from "lucide-react";
import { getCloneUrl, setCloneUrl, cloneHealth } from "@/lib/voices/clone-client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Réglage du serveur de clonage vocal LOCAL (auto-hébergé, aucun tiers).
 * Affiché sur la page de test quand l'agent utilise une voix enregistrée.
 */
export function CloneServerConfig() {
  const [url, setUrl] = useState("");
  const [state, setState] = useState<
    "idle" | "checking" | "ok" | "loading" | "ko"
  >("idle");
  const [detail, setDetail] = useState("");

  useEffect(() => {
    setUrl(getCloneUrl());
  }, []);

  async function check() {
    setCloneUrl(url);
    setState("checking");
    setDetail("");
    const h = await cloneHealth();
    if (!h.ok) {
      setState("ko");
    } else if (!h.loaded) {
      setState("loading");
      setDetail(h.error || "");
    } else {
      setState("ok");
    }
  }

  return (
    <Card className="border-brand/20 bg-brand-50/20 p-5">
      <div className="flex items-center gap-2">
        <Server className="size-4 text-brand" />
        <h2 className="text-[0.95rem] font-semibold tracking-tight">
          Voix clonée — serveur local
        </h2>
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">
        Ta voix enregistrée, sur n'importe quel texte, <strong>sans aucun service
        externe</strong>. Lance le serveur fourni (dossier{" "}
        <code className="font-mono">voice-clone-server</code>) puis vérifie la
        connexion ci-dessous.
      </p>

      <div className="mt-3 space-y-1.5">
        <Label htmlFor="clone-url">Adresse du serveur</Label>
        <div className="flex gap-2">
          <Input
            id="clone-url"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setState("idle");
            }}
            placeholder="http://localhost:8000"
            spellCheck={false}
          />
          <Button type="button" variant="outline" size="sm" onClick={check}>
            {state === "checking" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              "Vérifier"
            )}
          </Button>
        </div>
      </div>

      {state === "ok" && (
        <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600">
          <CheckCircle2 className="size-4" /> Connecté, modèle prêt — l'agent
          parlera avec ta voix.
        </p>
      )}
      {state === "loading" && (
        <p className="mt-2 inline-flex items-start gap-1.5 text-xs font-medium text-amber-700">
          <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin" />
          <span>
            Connecté, mais le <strong>modèle se charge</strong> (1ʳᵉ fois ~2 Go).
            Patiente quelques minutes puis re-clique « Vérifier ».
            {detail ? ` — ${detail}` : ""}
          </span>
        </p>
      )}
      {state === "ko" && (
        <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-amber-700">
          <XCircle className="size-4" /> Injoignable — lance le serveur (run.bat) et
          réessaie.
        </p>
      )}

      <p className="mt-3 text-[0.7rem] text-muted-foreground">
        Pas encore installé ? Suis le guide{" "}
        <code className="font-mono">voice-clone-server/README.md</code>.{" "}
        <a
          href="https://github.com/pirabellabs1-coder/callpme/tree/main/voice-clone-server"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-0.5 text-brand hover:underline"
        >
          Voir <ExternalLink className="size-3" />
        </a>
      </p>
    </Card>
  );
}
