"use client";

import { useState, useTransition } from "react";
import { Loader2, AlertCircle, ShieldCheck } from "lucide-react";
import { adminGateLogin } from "@/app/actions/admin-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AdminGateForm({
  gate,
  requirePassphrase,
}: {
  gate: string;
  requirePassphrase: boolean;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passphrase, setPassphrase] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const fd = new FormData();
    fd.set("gate", gate);
    fd.set("email", email);
    fd.set("password", password);
    fd.set("passphrase", passphrase);
    startTransition(async () => {
      const res = await adminGateLogin(fd);
      if (res.ok) {
        window.location.href = "/admin";
      } else {
        setError(res.error ?? "Accès refusé.");
      }
    });
  }

  return (
    <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-card p-7 shadow-2xl">
      <div className="flex flex-col items-center text-center">
        <span className="inline-flex size-12 items-center justify-center rounded-2xl bg-brand/10 text-brand ring-1 ring-inset ring-brand/20">
          <ShieldCheck className="size-6" />
        </span>
        <h1 className="mt-4 text-lg font-semibold tracking-tight text-foreground">
          Accès administrateur
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Espace réservé. Authentification renforcée requise.
        </p>
      </div>

      <form onSubmit={submit} className="mt-6 space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            type="email"
            autoComplete="off"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Mot de passe</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {requirePassphrase && (
          <div className="space-y-1.5">
            <Label htmlFor="passphrase">Phrase secrète</Label>
            <Input
              id="passphrase"
              type="password"
              autoComplete="off"
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              required
            />
          </div>
        )}

        {error && (
          <p className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="size-4 shrink-0" />
            {error}
          </p>
        )}

        <Button type="submit" variant="brand" className="w-full" disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
          Déverrouiller l&apos;espace admin
        </Button>
      </form>
    </div>
  );
}
