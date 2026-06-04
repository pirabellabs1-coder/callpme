"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, AlertCircle } from "lucide-react";
import { login } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const DEMO = { email: "contact@pirabellabs.com", password: "demo1234" };

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const fd = new FormData();
    fd.set("email", email);
    fd.set("password", password);
    startTransition(async () => {
      const res = await login(fd);
      if (res?.error) {
        setError(res.error);
        return;
      }
      router.push("/overview");
      router.refresh();
    });
  }

  return (
    <div>
      <h1 className="text-display-sm font-semibold tracking-tight">Connexion</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Ravi de vous revoir. Connectez-vous à votre espace.
      </p>

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
        <div className="space-y-2">
          <Label htmlFor="password">Mot de passe</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
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
          Se connecter
        </Button>
      </form>

      <button
        type="button"
        onClick={() => {
          setEmail(DEMO.email);
          setPassword(DEMO.password);
          setError(null);
        }}
        className="mt-3 w-full rounded-lg border border-dashed border-border bg-secondary/30 px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-secondary/60"
      >
        Compte de démonstration — cliquer pour pré-remplir
        <span className="mt-0.5 block font-mono text-[0.7rem] text-foreground/70">
          {DEMO.email} · {DEMO.password}
        </span>
      </button>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Pas encore de compte ?{" "}
        <Link href="/register" className="font-medium text-brand hover:underline">
          Créer un compte
        </Link>
      </p>
    </div>
  );
}
