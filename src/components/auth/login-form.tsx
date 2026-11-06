"use client";

import { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, AlertCircle, ShieldCheck } from "lucide-react";
import { login, verifyLoginCode } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
  );
}

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [googleError, setGoogleError] = useState(false);
  const [pending, startTransition] = useTransition();
  /** Deuxième étape : code de l'application d'authentification. */
  const [step, setStep] = useState<"password" | "code">("password");
  const [code, setCode] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("error") === "google") setGoogleError(true);
    // Retour de Google avec la double authentification active.
    if (params.get("step") === "2fa") setStep("code");
  }, []);

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
      if (res?.twoFactor) {
        setStep("code");
        setPassword("");
        return;
      }
      router.push("/overview");
      router.refresh();
    });
  }

  function submitCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const fd = new FormData();
    fd.set("code", code);
    startTransition(async () => {
      const res = await verifyLoginCode(fd);
      if (res?.error) {
        setError(res.error);
        if (res.expired) {
          setStep("password");
          setCode("");
        }
        return;
      }
      router.push("/overview");
      router.refresh();
    });
  }

  if (step === "code") {
    return (
      <div>
        <div className="flex size-11 items-center justify-center rounded-xl bg-brand-50 text-brand">
          <ShieldCheck className="size-5" strokeWidth={1.75} aria-hidden />
        </div>
        <h1 className="mt-4 text-display-sm font-semibold tracking-tight">Vérification en deux étapes</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Saisissez le code à 6 chiffres affiché dans votre application d&apos;authentification.
        </p>
        <form onSubmit={submitCode} className="mt-7 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="code">Code de vérification</Label>
            <Input
              id="code"
              name="code"
              autoComplete="one-time-code"
              inputMode="text"
              autoFocus
              maxLength={20}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="123 456"
              aria-describedby="code-help"
              aria-invalid={Boolean(error)}
              className="text-center font-mono text-lg tracking-[0.3em]"
              required
            />
            <p id="code-help" className="text-xs text-muted-foreground">
              Téléphone perdu ? Saisissez un de vos codes de secours (format XXXX-XXXX).
            </p>
          </div>
          {error && (
            <p role="alert" className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="size-4 shrink-0" />
              {error}
            </p>
          )}
          <Button type="submit" variant="brand" className="w-full" disabled={pending || !code.trim()}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            Valider
          </Button>
          <button
            type="button"
            className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
            onClick={() => {
              setStep("password");
              setCode("");
              setError(null);
            }}
          >
            Revenir à la connexion
          </button>
        </form>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-display-sm font-semibold tracking-tight">Connexion</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Ravi de vous revoir. Connectez-vous à votre espace.
      </p>

      <a
        href="/api/auth/google"
        className="mt-7 flex w-full items-center justify-center gap-2.5 rounded-lg border border-input bg-card px-4 py-2.5 text-sm font-medium shadow-xs transition-colors hover:bg-accent"
      >
        <GoogleIcon />
        Continuer avec Google
      </a>

      {googleError && (
        <p className="mt-3 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="size-4 shrink-0" />
          La connexion Google a échoué. Réessayez ou utilisez votre e-mail.
        </p>
      )}

      <div className="my-5 flex items-center gap-3">
        <span className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">ou par e-mail</span>
        <span className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={submit} className="space-y-4">
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
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Mot de passe</Label>
            <Link href="/mot-de-passe-oublie" className="text-xs text-muted-foreground hover:text-brand">
              Mot de passe oublié ?
            </Link>
          </div>
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

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Pas encore de compte ?{" "}
        <Link href="/register" className="font-medium text-brand hover:underline">
          Créer un compte
        </Link>
      </p>
    </div>
  );
}
