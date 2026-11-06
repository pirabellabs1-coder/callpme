"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Check, Copy, Loader2, MailPlus, Trash2, X } from "lucide-react";
import { changeMemberRole, inviteMember, removeMember, revokeInvitation } from "@/app/actions/team";
import { canGrant, canManage } from "@/lib/team/roles";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { initials } from "@/lib/utils";

export interface MemberView {
  id: string;
  name: string | null;
  email: string;
  role: string;
  twoFactor: boolean;
}

export interface InvitationView {
  id: string;
  email: string;
  role: string;
  expiresAt: string;
}

const ROLE_LABEL: Record<string, string> = { owner: "Propriétaire", admin: "Admin", member: "Membre" };

function RoleBadge({ role }: { role: string }) {
  return <Badge variant={role === "owner" ? "brand" : role === "admin" ? "default" : "muted"}>{ROLE_LABEL[role] ?? role}</Badge>;
}

export function TeamManager({
  me,
  members,
  invitations,
}: {
  me: { id: string; role: string };
  members: MemberView[];
  invitations: InvitationView[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<{ link: string; emailSent: boolean; email: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const isAdmin = me.role === "owner" || me.role === "admin";

  function run(action: () => Promise<{ error?: string }>) {
    startTransition(async () => {
      setError(null);
      const r = await action();
      if (r.error) setError(r.error);
      else router.refresh();
    });
  }

  return (
    <div>
      <ul className="divide-y divide-border border-t border-border">
        {members.map((u) => {
          const isMe = u.id === me.id;
          const manageable = canManage(me, u);
          return (
            <li key={u.id} className="flex flex-wrap items-center gap-3 px-5 py-3 sm:px-6">
              <span
                aria-hidden
                className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-foreground/75 ring-1 ring-inset ring-border"
              >
                {initials(u.name ?? u.email)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {u.name ?? "Sans nom"}
                  {isMe && <span className="ml-2 text-xs font-normal text-muted-foreground">(vous)</span>}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {u.email}
                  {u.twoFactor && <span className="ml-2 text-emerald-600 dark:text-emerald-400">· double authentification</span>}
                </p>
              </div>
              {manageable && me.role === "owner" ? (
                <div className="w-36">
                  <Select
                    aria-label={`Rôle de ${u.name ?? u.email}`}
                    value={u.role}
                    disabled={pending}
                    onChange={(e) => {
                      const next = e.target.value;
                      run(() => changeMemberRole(u.id, next));
                    }}
                  >
                    <option value="admin">Admin</option>
                    <option value="member">Membre</option>
                  </Select>
                </div>
              ) : (
                <RoleBadge role={u.role} />
              )}
              {manageable && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={pending}
                  aria-label={`Retirer ${u.name ?? u.email} de l'équipe`}
                  onClick={() => {
                    if (window.confirm(`Retirer ${u.name ?? u.email} ? Son accès est supprimé immédiatement.`)) {
                      run(() => removeMember(u.id));
                    }
                  }}
                >
                  <Trash2 aria-hidden />
                </Button>
              )}
            </li>
          );
        })}
        {invitations.map((inv) => (
          <li key={inv.id} className="flex flex-wrap items-center gap-3 px-5 py-3 sm:px-6">
            <span aria-hidden className="inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-dashed border-border text-muted-foreground">
              <MailPlus className="size-4" strokeWidth={1.75} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{inv.email}</p>
              <p className="text-xs text-muted-foreground">
                Invitation en attente · expire le {new Date(inv.expiresAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}
              </p>
            </div>
            <RoleBadge role={inv.role} />
            {isAdmin && (
              <Button variant="ghost" size="icon-sm" disabled={pending} aria-label={`Annuler l'invitation de ${inv.email}`} onClick={() => run(() => revokeInvitation(inv.id))}>
                <X aria-hidden />
              </Button>
            )}
          </li>
        ))}
      </ul>

      {isAdmin && (
        <form
          className="space-y-3 border-t border-border px-5 py-4 sm:px-6"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData();
            fd.set("email", email);
            fd.set("role", role);
            startTransition(async () => {
              setError(null);
              setSent(null);
              setCopied(false);
              const r = await inviteMember(fd);
              if (r.error) {
                setError(r.error);
                return;
              }
              setSent({ link: r.link ?? "", emailSent: Boolean(r.emailSent), email });
              setEmail("");
              router.refresh();
            });
          }}
        >
          <p className="text-sm font-medium">Inviter une personne</p>
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[14rem] flex-1 space-y-1.5">
              <Label htmlFor="invite-email-input" className="sr-only">
                E-mail
              </Label>
              <Input id="invite-email-input" type="email" placeholder="collegue@entreprise.fr" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="w-36">
              <Select aria-label="Rôle de la personne invitée" value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="member">Membre</option>
                {canGrant(me.role, "admin") && <option value="admin">Admin</option>}
              </Select>
            </div>
            <Button type="submit" variant="brand" disabled={pending || !email.trim()}>
              {pending ? <Loader2 className="animate-spin" aria-hidden /> : <MailPlus aria-hidden />}
              Inviter
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Admin : gère l&apos;équipe, les agents et la facturation. Membre : crée et pilote les agents.
          </p>
          {sent && (
            <div role="status" className="space-y-2 rounded-lg border border-border bg-secondary/40 p-3 text-sm">
              <p>
                {sent.emailSent
                  ? `Invitation envoyée à ${sent.email}.`
                  : `L'e-mail n'a pas pu partir : envoyez ce lien à ${sent.email} (WhatsApp, SMS…).`}{" "}
                Le lien est valable 7 jours.
              </p>
              {sent.link && <div className="flex gap-2">
                <Input readOnly value={sent.link} aria-label="Lien d'invitation" className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
                <Button
                  type="button"
                  variant="outline"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(sent.link);
                      setCopied(true);
                    } catch {
                      setCopied(false);
                    }
                  }}
                >
                  {copied ? <Check aria-hidden /> : <Copy aria-hidden />} {copied ? "Copié" : "Copier"}
                </Button>
              </div>}
            </div>
          )}
        </form>
      )}
      {error && (
        <p role="alert" className="mx-5 mb-4 flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive sm:mx-6">
          <AlertCircle className="size-4 shrink-0" aria-hidden /> {error}
        </p>
      )}
    </div>
  );
}
