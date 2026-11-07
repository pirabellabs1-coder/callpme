"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarOff, Check, Clock, Loader2, Trash2 } from "lucide-react";
import type { BookingConfig } from "@/lib/shared/types";
import { BookingSettings } from "@/components/agents/wizard/booking-settings";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { addUnavailability, removeUnavailability, saveBookingHours } from "@/app/actions/agenda";

export interface AgendaAgent {
  id: string;
  name: string;
  booking: BookingConfig | null;
}

export interface BlockRow {
  id: string;
  agentName: string | null;
  label: string;
  reason: string | null;
}

/**
 * Réglages de l'agenda depuis la page Rendez-vous : horaires de disponibilité
 * de chaque agent, et indisponibilités ponctuelles (congé, réunion…).
 */
export function AgendaSettings({ agents, blocks, canEdit }: { agents: AgendaAgent[]; blocks: BlockRow[]; canEdit: boolean }) {
  const router = useRouter();
  const [agentId, setAgentId] = useState(agents[0]?.id ?? "");
  const current = agents.find((a) => a.id === agentId) ?? null;
  const [booking, setBooking] = useState<BookingConfig | null>(current?.booking ?? null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  if (agents.length === 0) {
    return (
      <Card className="p-5 text-sm text-muted-foreground">
        Aucun agent ne prend de rendez-vous. Activez les outils « Vérifier les disponibilités » et « Prendre un rendez-vous »
        sur un agent pour régler ses horaires ici.
      </Card>
    );
  }

  async function saveHours() {
    setBusy("hours");
    setMsg(null);
    const res = await saveBookingHours(agentId, booking);
    setBusy(null);
    setMsg({ ok: !res.error, text: res.error ?? "Horaires enregistrés : l'agent les applique dès le prochain appel." });
    router.refresh();
  }

  async function addBlock(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    setBusy("block");
    setMsg(null);
    const res = await addUnavailability({
      agentId,
      date: String(f.get("date") ?? ""),
      from: String(f.get("from") ?? ""),
      to: String(f.get("to") ?? ""),
      reason: String(f.get("reason") ?? "") || undefined,
    });
    setBusy(null);
    setMsg({ ok: !res.error, text: res.error ?? res.warning ?? "Indisponibilité ajoutée : l'agent ne proposera plus ce créneau." });
    if (!res.error) form.reset();
    router.refresh();
  }

  async function removeBlock(id: string) {
    setBusy(id);
    const res = await removeUnavailability(id);
    setBusy(null);
    if (res.error) setMsg({ ok: false, text: res.error });
    router.refresh();
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card className="space-y-4 p-5">
        <div>
          <h2 className="flex items-center gap-2 text-[0.95rem] font-semibold tracking-tight">
            <Clock className="size-4 text-muted-foreground" aria-hidden="true" /> Horaires de disponibilité
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            L&apos;agent ne propose aux appelants que des créneaux libres dans ces horaires.
          </p>
        </div>
        {agents.length > 1 && (
          <div className="space-y-1.5">
            <Label htmlFor="ag-agent">Agent</Label>
            <Select
              id="ag-agent"
              value={agentId}
              onChange={(e) => {
                setAgentId(e.target.value);
                setBooking(agents.find((a) => a.id === e.target.value)?.booking ?? null);
              }}
            >
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </div>
        )}
        <BookingSettings value={booking} onChange={setBooking} />
        {canEdit && (
          <Button variant="brand" size="sm" onClick={saveHours} disabled={busy === "hours"}>
            {busy === "hours" ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Check className="size-4" aria-hidden="true" />}
            Enregistrer les horaires
          </Button>
        )}
      </Card>

      <Card className="space-y-4 p-5">
        <div>
          <h2 className="flex items-center gap-2 text-[0.95rem] font-semibold tracking-tight">
            <CalendarOff className="size-4 text-muted-foreground" aria-hidden="true" /> Indisponibilités
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Congé, réunion, absence : bloquez un créneau, l&apos;agent ne le proposera plus.
            {agents.length > 1 && current ? ` (agent : ${current.name})` : ""}
          </p>
        </div>
        {canEdit && (
          <form onSubmit={addBlock} className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
            <div className="space-y-1.5">
              <Label htmlFor="bl-date">Date</Label>
              <Input id="bl-date" name="date" type="date" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bl-from">De</Label>
              <Input id="bl-from" name="from" type="time" defaultValue="09:00" required className="w-[7.5rem]" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bl-to">À</Label>
              <Input id="bl-to" name="to" type="time" defaultValue="18:00" required className="w-[7.5rem]" aria-describedby="bl-to-hint" />
              <span id="bl-to-hint" className="block text-[0.7rem] text-muted-foreground">23:59 = toute la soirée</span>
            </div>
            <div className="space-y-1.5 sm:col-span-3">
              <Label htmlFor="bl-reason">Motif (facultatif, visible par vous seul)</Label>
              <Input id="bl-reason" name="reason" maxLength={120} placeholder="ex. congé, formation" />
            </div>
            <div className="sm:col-span-3">
              <Button type="submit" size="sm" variant="secondary" disabled={busy === "block"}>
                {busy === "block" && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                Bloquer ce créneau
              </Button>
            </div>
          </form>
        )}
        {blocks.length > 0 && (
          <ul className="divide-y divide-border rounded-lg border border-border text-sm">
            {blocks.map((b) => (
              <li key={b.id} className="flex items-center gap-3 px-3 py-2">
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{b.label}</span>
                  <span className="text-muted-foreground">
                    {b.agentName ? ` · ${b.agentName}` : ""}
                    {b.reason ? ` · ${b.reason}` : ""}
                  </span>
                </span>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => removeBlock(b.id)}
                    disabled={busy === b.id}
                    aria-label={`Retirer l'indisponibilité du ${b.label}`}
                    className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  >
                    {busy === b.id ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Trash2 className="size-4" aria-hidden="true" />}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {msg && (
        <p role="status" className={`text-sm lg:col-span-2 ${msg.ok ? "text-emerald-300" : "text-rose-300"}`}>
          {msg.text}
        </p>
      )}
    </div>
  );
}
