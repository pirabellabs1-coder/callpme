"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, AlertCircle } from "lucide-react";
import { register } from "@/app/actions/auth";
import { getPlan, isPlanId } from "@/lib/billing/plans";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

export function RegisterForm({ plan }: { plan?: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState({
    organizationName: "",
    name: "",
    email: "",
    password: "",
  });
  const selectedPlan = plan && isPlanId(plan) ? getPlan(plan) : null;

  function set(k: keyof typeof form, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => fd.set(k, v));
    if (selectedPlan) fd.set("plan", selectedPlan.id);
    startTransition(async () => {
      const res = await register(fd);
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
      <h1 className="text-display-sm font-semibold tracking-tight">
        Créer un compte
      </h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Lancez votre première agence d'agents vocaux en deux minutes.
      </p>

      {selectedPlan && (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm">
          <Badge variant="brand">{selectedPlan.name}</Badge>
          <span className="text-muted-foreground">
            {selectedPlan.priceLabel} {selectedPlan.period}
          </span>
        </div>
      )}

      <form onSubmit={submit} className="mt-6 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="org">Nom de l'organisation</Label>
          <Input
            id="org"
            value={form.organizationName}
            onChange={(e) => set("organizationName", e.target.value)}
            placeholder="Mon agence vocale"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="name">Votre nom</Label>
          <Input
            id="name"
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="Camille Martin"
            autoComplete="name"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">E-mail professionnel</Label>
          <Input
            id="email"
            type="email"
            value={form.email}
            onChange={(e) => set("email", e.target.value)}
            placeholder="vous@entreprise.fr"
            autoComplete="email"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Mot de passe</Label>
          <Input
            id="password"
            type="password"
            value={form.password}
            onChange={(e) => set("password", e.target.value)}
            placeholder="8 caractères minimum"
            autoComplete="new-password"
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
          Créer mon compte
        </Button>
      </form>

      <p className="mt-5 text-center text-xs text-muted-foreground">
        En créant un compte, vous acceptez nos conditions d'utilisation.
      </p>
      <p className="mt-4 text-center text-sm text-muted-foreground">
        Déjà un compte ?{" "}
        <Link href="/login" className="font-medium text-brand hover:underline">
          Se connecter
        </Link>
      </p>
    </div>
  );
}
