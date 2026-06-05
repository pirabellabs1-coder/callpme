"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { resetPassword } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ResetForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const fd = new FormData();
    fd.set("token", token);
    fd.set("password", password);
    start(async () => {
      const r = await resetPassword(fd);
      if (r?.error) {
        setError(r.error);
        return;
      }
      setDone(true);
      setTimeout(() => router.push("/login"), 1600);
    });
  }

  if (!token) {
    return (
      <div>
        <h1 className="text-display-sm font-semibold tracking-tight">Lien invalide</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Ce lien de réinitialisation est incomplet ou a expiré.
        </p>
        <Link
          href="/mot-de-passe-oublie"
          className="mt-6 inline-block text-sm font-medium text-brand hover:underline"
        >
          Refaire une demande
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-display-sm font-semibold tracking-tight">
        Nouveau mot de passe
      </h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Choisissez un nouveau mot de passe pour votre compte.
      </p>

      {done ? (
        <div className="mt-7 flex items-start gap-2 rounded-lg border border-emerald-600/20 bg-emerald-50/60 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
          Mot de passe réinitialisé. Redirection vers la connexion…
        </div>
      ) : (
        <form onSubmit={submit} className="mt-7 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">Nouveau mot de passe</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="8 caractères minimum"
              minLength={8}
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
            Réinitialiser
          </Button>
        </form>
      )}
    </div>
  );
}
