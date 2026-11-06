"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, Copy, Download, Loader2, ShieldCheck, ShieldOff } from "lucide-react";
import {
  confirmTwoFactorSetup,
  disableTwoFactor,
  regenerateBackupCodes,
  startTwoFactorSetup,
} from "@/app/actions/two-factor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function ErrorLine({ text }: { text: string | null }) {
  if (!text) return null;
  return (
    <p role="alert" className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
      <AlertCircle className="size-4 shrink-0" aria-hidden /> {text}
    </p>
  );
}

/** Codes de secours affichés une seule fois, à copier ou télécharger. */
function BackupCodes({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  const [copied, setCopied] = useState(false);
  const text = codes.join("\n");
  return (
    <div className="space-y-3 rounded-xl border border-amber-500/40 bg-amber-500/5 p-4">
      <p className="text-sm font-medium">Vos codes de secours</p>
      <p className="text-sm text-muted-foreground">
        Chaque code permet une connexion si vous perdez votre téléphone. Ils ne seront plus affichés : gardez-les en lieu sûr.
      </p>
      <ul className="grid grid-cols-2 gap-1.5 font-mono text-sm sm:grid-cols-5" aria-label="Codes de secours">
        {codes.map((c) => (
          <li key={c} className="rounded-md bg-card px-2 py-1 text-center ring-1 ring-inset ring-border">
            {c}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(text);
              setCopied(true);
            } catch {
              setCopied(false);
            }
          }}
        >
          {copied ? <Check aria-hidden /> : <Copy aria-hidden />} {copied ? "Copiés" : "Copier"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            const url = URL.createObjectURL(new Blob([`Codes de secours Callpme\n\n${text}\n`], { type: "text/plain" }));
            const a = document.createElement("a");
            a.href = url;
            a.download = "callpme-codes-de-secours.txt";
            a.click();
            URL.revokeObjectURL(url);
          }}
        >
          <Download aria-hidden /> Télécharger
        </Button>
        <Button type="button" variant="brand" size="sm" onClick={onDone}>
          J&apos;ai mis mes codes de côté
        </Button>
      </div>
    </div>
  );
}

export function TwoFactorCard({ enabled, backupRemaining }: { enabled: boolean; backupRemaining: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [setup, setSetup] = useState<{ qr: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [codes, setCodes] = useState<string[] | null>(null);
  const [mode, setMode] = useState<"idle" | "disable" | "regenerate">("idle");

  const reset = () => {
    setCode("");
    setPassword("");
    setError(null);
    setMode("idle");
  };

  if (codes) {
    return (
      <BackupCodes
        codes={codes}
        onDone={() => {
          setCodes(null);
          reset();
          router.refresh();
        }}
      />
    );
  }

  if (!enabled) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="muted">Désactivée</Badge>
          <p className="text-sm text-muted-foreground">
            Un code de votre téléphone est demandé en plus du mot de passe : un mot de passe volé ne suffit plus.
          </p>
        </div>
        {!setup ? (
          <Button
            variant="brand"
            size="sm"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                setError(null);
                const r = await startTwoFactorSetup();
                if (r.error || !r.qr || !r.secret) setError(r.error ?? "Activation impossible.");
                else setSetup({ qr: r.qr, secret: r.secret });
              })
            }
          >
            {pending ? <Loader2 className="animate-spin" aria-hidden /> : <ShieldCheck aria-hidden />}
            Activer la double authentification
          </Button>
        ) : (
          <form
            className="grid gap-5 sm:grid-cols-[auto_minmax(0,1fr)]"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData();
              fd.set("code", code);
              startTransition(async () => {
                setError(null);
                const r = await confirmTwoFactorSetup(fd);
                if (r.error) setError(r.error);
                else if (r.backupCodes) {
                  setSetup(null);
                  setCodes(r.backupCodes);
                }
              });
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={setup.qr} alt="QR code à scanner avec votre application d'authentification" width={180} height={180} className="rounded-lg bg-white p-1" />
            <div className="space-y-3">
              <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
                <li>Ouvrez Google Authenticator, Microsoft Authenticator, 1Password…</li>
                <li>Scannez le QR code, ou saisissez la clé ci-dessous.</li>
                <li>Entrez le code à 6 chiffres affiché.</li>
              </ol>
              <p className="break-all rounded-md bg-secondary px-2 py-1 font-mono text-xs" aria-label="Clé à saisir à la main">
                {setup.secret}
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="totp-confirm">Code à 6 chiffres</Label>
                <Input
                  id="totp-confirm"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={7}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="max-w-[10rem] text-center font-mono tracking-[0.25em]"
                  required
                />
              </div>
              <ErrorLine text={error} />
              <div className="flex gap-2">
                <Button type="submit" variant="brand" size="sm" disabled={pending || code.replace(/\s/g, "").length !== 6}>
                  {pending && <Loader2 className="animate-spin" aria-hidden />} Activer
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setSetup(null)}>
                  Annuler
                </Button>
              </div>
            </div>
          </form>
        )}
        {!setup && <ErrorLine text={error} />}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Badge variant="success">Activée</Badge>
        <p className="text-sm text-muted-foreground">
          {backupRemaining} code{backupRemaining > 1 ? "s" : ""} de secours restant{backupRemaining > 1 ? "s" : ""}.
        </p>
      </div>
      {mode === "idle" ? (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setMode("regenerate")}>
            Nouveaux codes de secours
          </Button>
          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setMode("disable")}>
            <ShieldOff aria-hidden /> Désactiver
          </Button>
        </div>
      ) : (
        <form
          className="max-w-md space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData();
            fd.set("code", code);
            fd.set("password", password);
            startTransition(async () => {
              setError(null);
              const r = mode === "disable" ? await disableTwoFactor(fd) : await regenerateBackupCodes(fd);
              if (r.error) setError(r.error);
              else if (r.backupCodes) setCodes(r.backupCodes);
              else {
                reset();
                router.refresh();
              }
            });
          }}
        >
          {mode === "disable" && (
            <div className="space-y-1.5">
              <Label htmlFor="2fa-password">Mot de passe</Label>
              <Input id="2fa-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="2fa-code">Code de l&apos;application ou code de secours</Label>
            <Input id="2fa-code" autoComplete="one-time-code" maxLength={20} value={code} onChange={(e) => setCode(e.target.value)} required />
          </div>
          <ErrorLine text={error} />
          <div className="flex gap-2">
            <Button type="submit" variant={mode === "disable" ? "destructive" : "brand"} size="sm" disabled={pending}>
              {pending && <Loader2 className="animate-spin" aria-hidden />}
              {mode === "disable" ? "Désactiver la double authentification" : "Générer de nouveaux codes"}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={reset}>
              Annuler
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
