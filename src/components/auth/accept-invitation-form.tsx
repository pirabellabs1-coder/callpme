"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2 } from "lucide-react";
import { acceptInvitation } from "@/app/actions/team";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AcceptInvitationForm({
  token,
  email,
  orgName,
  role,
}: {
  token: string;
  email: string;
  orgName: string;
  role: string;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div>
      <h1 className="text-display-sm font-semibold tracking-tight">Rejoindre {orgName}</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Vous êtes invité en tant que {role}. Choisissez votre nom et un mot de passe pour créer votre accès.
      </p>
      <form
        className="mt-7 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          const fd = new FormData();
          fd.set("token", token);
          fd.set("name", name);
          fd.set("password", password);
          startTransition(async () => {
            const r = await acceptInvitation(fd);
            if (r.error) {
              setError(r.error);
              return;
            }
            router.push(r.next ?? "/overview");
            router.refresh();
          });
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="invite-email">E-mail</Label>
          <Input id="invite-email" type="email" value={email} readOnly aria-readonly className="opacity-80" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="invite-name">Votre nom</Label>
          <Input id="invite-name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="invite-password">Mot de passe</Label>
          <Input
            id="invite-password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="8 caractères minimum"
            required
          />
        </div>
        {error && (
          <p role="alert" className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="size-4 shrink-0" aria-hidden /> {error}
          </p>
        )}
        <Button type="submit" variant="brand" className="w-full" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
          Rejoindre l&apos;équipe
        </Button>
      </form>
    </div>
  );
}
