"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { requestPasswordReset } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ForgotForm() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const fd = new FormData();
    fd.set("email", email);
    start(async () => {
      const r = await requestPasswordReset(fd);
      if (r?.error) {
        setError(r.error);
        return;
      }
      setSent(true);
    });
  }

  return (
    <div>
      <h1 className="text-display-sm font-semibold tracking-tight">
        Mot de passe oublié
      </h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Entrez votre e-mail : nous vous envoyons un lien de réinitialisation
        valable 1 heure.
      </p>

      {sent ? (
        <div className="mt-7 flex items-start gap-2 rounded-lg border border-emerald-600/20 bg-emerald-50/60 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
          Si un compte existe pour cet e-mail, un lien vient d'être envoyé.
          Vérifiez votre boîte de réception (et les spams).
        </div>
      ) : (
        <form onSubmit={submit} className="mt-7 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="vous@entreprise.fr"
              required
            />
          </div>
          {error && (
            <p className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="size-4 shrink-0" />
              {error}
            </p>
          )}
          <Button type="submit" variant="brand" className="w-full" disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            Envoyer le lien
          </Button>
        </form>
      )}

      <p className="mt-6 text-center text-sm text-muted-foreground">
        <Link href="/login" className="font-medium text-brand hover:underline">
          Retour à la connexion
        </Link>
      </p>
    </div>
  );
}
