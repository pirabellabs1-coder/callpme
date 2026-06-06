"use client";

import { useState } from "react";
import { PhoneCall, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function RealCallCard({ agentId }: { agentId: string }) {
  const [number, setNumber] = useState("");
  const [status, setStatus] = useState<"idle" | "calling" | "ok" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function call(e: React.FormEvent) {
    e.preventDefault();
    setStatus("calling");
    setMessage(null);
    try {
      const res = await fetch(`/api/agents/${agentId}/call-real`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toNumber: number }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus("ok");
        setMessage("Appel lancé ! Votre téléphone va sonner dans quelques secondes.");
      } else {
        setStatus("error");
        setMessage(data.error ?? "Appel impossible.");
      }
    } catch {
      setStatus("error");
      setMessage("Appel impossible (réseau).");
    }
  }

  return (
    <Card className="border-brand/20 bg-brand-50/30 p-5">
      <h2 className="flex items-center gap-2 text-[0.95rem] font-semibold tracking-tight">
        <PhoneCall className="size-4 text-brand" />
        Appel téléphonique réel
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Votre agent vous appelle sur un vrai téléphone et vous parle en direct.
        Entrez un numéro (format international, ex. +33 6…).
      </p>
      <form onSubmit={call} className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Input
          type="tel"
          value={number}
          onChange={(e) => setNumber(e.target.value)}
          placeholder="+33 6 12 34 56 78"
          className="flex-1"
        />
        <Button type="submit" variant="brand" disabled={status === "calling" || number.trim().length < 6}>
          {status === "calling" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <PhoneCall className="size-4" />
          )}
          M&apos;appeler
        </Button>
      </form>
      {message && (
        <p
          className={
            "mt-3 flex items-center gap-2 text-sm " +
            (status === "ok" ? "text-emerald-600" : "text-destructive")
          }
        >
          {status === "ok" ? (
            <CheckCircle2 className="size-4 shrink-0" />
          ) : (
            <AlertCircle className="size-4 shrink-0" />
          )}
          {message}
        </p>
      )}
    </Card>
  );
}
