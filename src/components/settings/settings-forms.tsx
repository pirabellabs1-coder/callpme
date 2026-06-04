"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, AlertCircle, Check } from "lucide-react";
import {
  updateOrganization,
  updateProfile,
  changePassword,
  type SettingsResult,
} from "@/app/actions/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function Feedback({
  error,
  saved,
}: {
  error: string | null;
  saved: boolean;
}) {
  if (error) {
    return (
      <p className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
        <AlertCircle className="size-4 shrink-0" />
        {error}
      </p>
    );
  }
  if (saved) {
    return (
      <p className="flex items-center gap-2 rounded-lg border border-emerald-600/20 bg-emerald-50/60 px-3 py-2 text-sm text-emerald-700">
        <Check className="size-4 shrink-0" />
        Enregistré.
      </p>
    );
  }
  return null;
}

/* --------------------------- Organisation -------------------------------- */

export function OrganizationForm({ name }: { name: string }) {
  const router = useRouter();
  const [value, setValue] = useState(name);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    const fd = new FormData();
    fd.set("name", value);
    start(async () => {
      const res: SettingsResult = await updateOrganization(fd);
      if (res.error) return setError(res.error);
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="org-name">Nom de l'organisation</Label>
        <Input
          id="org-name"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setSaved(false);
          }}
          placeholder="Mon agence"
        />
      </div>
      <Feedback error={error} saved={saved} />
      <Button
        type="submit"
        variant="brand"
        size="sm"
        disabled={pending || value.trim() === name.trim() || value.trim().length < 2}
      >
        {pending && <Loader2 className="size-4 animate-spin" />}
        Enregistrer
      </Button>
    </form>
  );
}

/* ------------------------------- Profil ---------------------------------- */

export function ProfileForm({
  name,
  email,
}: {
  name: string;
  email: string;
}) {
  const router = useRouter();
  const [n, setN] = useState(name);
  const [e, setE] = useState(email);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  function submit(ev: React.FormEvent) {
    ev.preventDefault();
    setError(null);
    setSaved(false);
    const fd = new FormData();
    fd.set("name", n);
    fd.set("email", e);
    start(async () => {
      const res: SettingsResult = await updateProfile(fd);
      if (res.error) return setError(res.error);
      setSaved(true);
      router.refresh();
    });
  }

  const dirty = n.trim() !== name.trim() || e.trim() !== email.trim();

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="profile-name">Votre nom</Label>
          <Input
            id="profile-name"
            value={n}
            onChange={(ev) => {
              setN(ev.target.value);
              setSaved(false);
            }}
            placeholder="Prénom Nom"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="profile-email">E-mail</Label>
          <Input
            id="profile-email"
            type="email"
            value={e}
            onChange={(ev) => {
              setE(ev.target.value);
              setSaved(false);
            }}
            placeholder="vous@entreprise.fr"
          />
        </div>
      </div>
      <Feedback error={error} saved={saved} />
      <Button type="submit" variant="brand" size="sm" disabled={pending || !dirty}>
        {pending && <Loader2 className="size-4 animate-spin" />}
        Mettre à jour
      </Button>
    </form>
  );
}

/* ----------------------------- Mot de passe ------------------------------ */

export function PasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    if (next.length < 8) {
      return setError("Le nouveau mot de passe doit faire au moins 8 caractères.");
    }
    if (next !== confirm) {
      return setError("La confirmation ne correspond pas.");
    }
    const fd = new FormData();
    fd.set("current", current);
    fd.set("next", next);
    start(async () => {
      const res: SettingsResult = await changePassword(fd);
      if (res.error) return setError(res.error);
      setSaved(true);
      setCurrent("");
      setNext("");
      setConfirm("");
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="pwd-current">Mot de passe actuel</Label>
        <Input
          id="pwd-current"
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          placeholder="••••••••"
        />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="pwd-next">Nouveau mot de passe</Label>
          <Input
            id="pwd-next"
            type="password"
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            placeholder="Au moins 8 caractères"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pwd-confirm">Confirmer</Label>
          <Input
            id="pwd-confirm"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Répétez le mot de passe"
          />
        </div>
      </div>
      <Feedback error={error} saved={saved} />
      <Button
        type="submit"
        variant="brand"
        size="sm"
        disabled={pending || !current || !next || !confirm}
      >
        {pending && <Loader2 className="size-4 animate-spin" />}
        Mettre à jour le mot de passe
      </Button>
    </form>
  );
}
