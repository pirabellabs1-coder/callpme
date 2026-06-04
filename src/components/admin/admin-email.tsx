"use client";

import { useState, useTransition } from "react";
import { Loader2, AlertCircle, Check, Send } from "lucide-react";
import { sendPlatformEmail, type AdminResult } from "@/app/actions/admin";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

export function AdminEmail({
  users,
  resendReady,
}: {
  users: { email: string; name: string | null }[];
  resendReady: boolean;
}) {
  const [target, setTarget] = useState("all");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    const fd = new FormData();
    fd.set("target", target);
    fd.set("subject", subject);
    fd.set("message", message);
    start(async () => {
      const res: AdminResult = await sendPlatformEmail(fd);
      if (res.error) return setError(res.error);
      setInfo(res.info ?? "Envoyé.");
      setSubject("");
      setMessage("");
    });
  }

  return (
    <Card className="p-5">
      {!resendReady && (
        <p className="mb-4 flex items-center gap-2 rounded-lg border border-amber-600/20 bg-amber-50/60 px-3 py-2 text-sm text-amber-700">
          <AlertCircle className="size-4 shrink-0" />
          Resend non configuré (RESEND_API_KEY). Les envois échoueront.
        </p>
      )}
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="target">Destinataire</Label>
          <Select id="target" value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value="all">Tous les utilisateurs ({users.length})</option>
            {users.map((u) => (
              <option key={u.email} value={u.email}>
                {u.name ? `${u.name} — ${u.email}` : u.email}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="subject">Sujet</Label>
          <Input
            id="subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Nouveautés Callpme"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="message">Message</Label>
          <Textarea
            id="message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={7}
            placeholder="Bonjour,&#10;&#10;Voici les dernières nouveautés…"
          />
        </div>

        {error && (
          <p className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="size-4 shrink-0" />
            {error}
          </p>
        )}
        {info && (
          <p className="flex items-center gap-2 rounded-lg border border-emerald-600/20 bg-emerald-50/60 px-3 py-2 text-sm text-emerald-700">
            <Check className="size-4 shrink-0" />
            {info}
          </p>
        )}

        <Button
          type="submit"
          variant="brand"
          disabled={pending || !subject.trim() || !message.trim()}
        >
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          Envoyer l'e-mail
        </Button>
      </form>
    </Card>
  );
}
