"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, Copy, Loader2, MailPlus, Trash2 } from "lucide-react";
import { revokeClientAccess, saveAgencyBrand } from "@/app/actions/clients";
import { inviteClientUser } from "@/app/actions/team";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface AccessRow {
  id: string;
  name: string;
  users: { id: string; email: string; name: string | null }[];
  pending: { id: string; email: string }[];
}

function Message({ msg }: { msg: { ok: boolean; text: string } | null }) {
  if (!msg) return null;
  return (
    <p role={msg.ok ? "status" : "alert"} className={msg.ok ? "flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400" : "flex items-center gap-1.5 text-sm text-destructive"}>
      {msg.ok ? <Check className="size-4" aria-hidden /> : <AlertCircle className="size-4" aria-hidden />} {msg.text}
    </p>
  );
}

export function AgencyBrandForm({ initial }: { initial: { brandName: string; brandLogoUrl: string; customDomain: string } }) {
  const [form, setForm] = useState(initial);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <Card className="space-y-4 p-5">
      <div>
        <h2 className="text-[0.95rem] font-semibold tracking-tight">Marque blanche</h2>
        <p className="text-sm text-muted-foreground">
          Votre nom et votre logo sur l&apos;espace de vos clients, sans mention de la plateforme.
        </p>
      </div>
      <form
        className="grid gap-4 sm:grid-cols-3"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData();
          Object.entries(form).forEach(([k, v]) => fd.set(k, v));
          setMsg(null);
          start(async () => {
            const r = await saveAgencyBrand(fd);
            setMsg(r.error ? { ok: false, text: r.error } : { ok: true, text: "Marque enregistrée." });
          });
        }}
      >
        <div className="space-y-1.5">
          <Label htmlFor="brand-name">Nom de l&apos;agence</Label>
          <Input id="brand-name" maxLength={60} value={form.brandName} onChange={(e) => setForm({ ...form, brandName: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="brand-logo">Logo (adresse https)</Label>
          <Input id="brand-logo" type="url" value={form.brandLogoUrl} placeholder="https://…/logo.png" onChange={(e) => setForm({ ...form, brandLogoUrl: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="brand-domain">Domaine de l&apos;espace client</Label>
          <Input id="brand-domain" value={form.customDomain} placeholder="espace.monagence.bj" onChange={(e) => setForm({ ...form, customDomain: e.target.value })} aria-describedby="brand-domain-help" />
        </div>
        <p id="brand-domain-help" className="text-xs text-muted-foreground sm:col-span-3">
          Facultatif. Créez chez votre hébergeur de domaine un enregistrement CNAME vers cname.vercel-dns.com, puis demandez à
          l&apos;équipe Callpme de l&apos;activer : vos clients se connecteront sur votre adresse, à vos couleurs.
        </p>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-3">
          <Button type="submit" variant="brand" size="sm" disabled={pending}>
            {pending && <Loader2 className="animate-spin" aria-hidden />} Enregistrer
          </Button>
          <Message msg={msg} />
        </div>
      </form>
    </Card>
  );
}

export function ClientAccessManager({ rows }: { rows: AccessRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [emails, setEmails] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  return (
    <Card className="space-y-4 p-5">
      <div>
        <h2 className="text-[0.95rem] font-semibold tracking-tight">Accès clients</h2>
        <p className="text-sm text-muted-foreground">
          Chaque client consulte ses appels, rendez-vous, prospects et son rapport mensuel, sans voir vos autres clients ni vos réglages.
        </p>
      </div>
      {rows.length === 0 && <p className="text-sm text-muted-foreground">Créez d&apos;abord un client ci-dessus.</p>}
      <ul className="divide-y divide-border">
        {rows.map((c) => (
          <li key={c.id} className="space-y-2 py-3">
            <p className="font-medium">{c.name}</p>
            {c.users.map((u) => (
              <div key={u.id} className="flex items-center gap-2 text-sm">
                <span className="flex-1 truncate">
                  {u.name ?? u.email} <span className="text-muted-foreground">· {u.email}</span>
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Retirer l'accès de ${u.email}`}
                  disabled={pending}
                  onClick={() => {
                    if (!window.confirm(`Retirer l'accès de ${u.email} ?`)) return;
                    start(async () => {
                      const r = await revokeClientAccess(u.id);
                      setMsg(r.error ? { ok: false, text: r.error } : { ok: true, text: "Accès retiré." });
                      router.refresh();
                    });
                  }}
                >
                  <Trash2 aria-hidden />
                </Button>
              </div>
            ))}
            {c.pending.map((p) => (
              <p key={p.id} className="text-sm text-muted-foreground">
                {p.email} · invitation en attente
              </p>
            ))}
            <form
              className="flex flex-wrap gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                setMsg(null);
                setLink(null);
                start(async () => {
                  const r = await inviteClientUser(c.id, emails[c.id] ?? "");
                  if (r.error) setMsg({ ok: false, text: r.error });
                  else {
                    setMsg({ ok: true, text: r.emailSent ? "Invitation envoyée." : "L'e-mail n'a pas pu partir : transmettez ce lien au client." });
                    setLink(r.link ?? null);
                    setEmails({ ...emails, [c.id]: "" });
                    router.refresh();
                  }
                });
              }}
            >
              <Label htmlFor={`access-${c.id}`} className="sr-only">
                E-mail du client {c.name}
              </Label>
              <Input
                id={`access-${c.id}`}
                type="email"
                className="max-w-xs"
                placeholder="contact@client.bj"
                value={emails[c.id] ?? ""}
                onChange={(e) => setEmails({ ...emails, [c.id]: e.target.value })}
                required
              />
              <Button type="submit" variant="outline" size="sm" disabled={pending}>
                <MailPlus aria-hidden /> Donner un accès
              </Button>
            </form>
          </li>
        ))}
      </ul>
      <Message msg={msg} />
      {link && (
        <div className="flex gap-2">
          <Input readOnly value={link} aria-label="Lien d'invitation" className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
          <Button
            type="button"
            variant="outline"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(link);
                setCopied(true);
              } catch {
                setCopied(false);
              }
            }}
          >
            {copied ? <Check aria-hidden /> : <Copy aria-hidden />} {copied ? "Copié" : "Copier"}
          </Button>
        </div>
      )}
    </Card>
  );
}
