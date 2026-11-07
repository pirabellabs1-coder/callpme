"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarCheck2, ChevronLeft, ChevronRight, Phone, X } from "lucide-react";
import { CancelAppointmentButton } from "./cancel-appointment-button";
import { RemoveBlockButton } from "./remove-block-button";
import { utcToZoned } from "@/lib/agenda/time";
import { addDays, mondayOf } from "@/lib/agenda/calendar-dates";
import type { TimeRange } from "@/lib/shared/types";
import { cn } from "@/lib/utils";

export interface CalendarEvent {
  id: string;
  title: string;
  reference: string;
  startsAt: string;
  durationMin: number;
  agentName: string | null;
  notes: string | null;
  phone: string | null;
  synced: boolean;
  block: boolean;
  timezone: string;
  /** Appel qui a pris le rendez-vous et son résumé. */
  callId: string | null;
  summary: string | null;
}

const DAY_NAMES = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
/** Heures affichées dans la vue semaine. */
const FIRST_HOUR = 7;
const LAST_HOUR = 21;
const HOUR_PX = 64;

function minutesOf(hm: string): number {
  const [h, m] = hm.split(":").map(Number);
  return h * 60 + m;
}

function dayNum(ymd: string) {
  return Number(ymd.slice(8, 10));
}

/** Heure locale d'un événement, dans son propre fuseau (celui de l'agenda de l'agent). */
function local(e: CalendarEvent) {
  const z = utcToZoned(new Date(e.startsAt), e.timezone);
  return { ymd: z.ymd, start: minutesOf(z.hm), hm: z.hm };
}

export function AgendaCalendar({
  mode,
  anchor,
  today,
  events,
  openHours,
  canEdit,
}: {
  mode: "semaine" | "mois";
  /** Date affichée (AAAA-MM-JJ). */
  anchor: string;
  today: string;
  events: CalendarEvent[];
  /** Horaires d'ouverture (0 = dimanche … 6 = samedi) pour griser les heures fermées. */
  openHours: Partial<Record<string, TimeRange[]>> | null;
  canEdit: boolean;
}) {
  const [selected, setSelected] = useState<CalendarEvent | null>(null);
  const details = selected ? <EventDetails event={selected} canEdit={canEdit} onClose={() => setSelected(null)} /> : null;
  const href = (date: string, m: "semaine" | "mois" = mode) => `/appointments?mode=${m}&date=${date}`;
  const byDay = new Map<string, (CalendarEvent & { start: number; hm: string })[]>();
  for (const e of events) {
    const l = local(e);
    const list = byDay.get(l.ymd) ?? [];
    list.push({ ...e, start: l.start, hm: l.hm });
    byDay.set(l.ymd, list);
  }

  if (mode === "mois") {
    const [y, m] = anchor.split("-").map(Number);
    const first = `${anchor.slice(0, 7)}-01`;
    const gridStart = mondayOf(first);
    const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
    const prev = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 10);
    const next = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
    return (
      <div className="space-y-3">
        <Toolbar title={`${MONTHS[m - 1]} ${y}`} prev={href(prev)} next={href(next)} today={href(today)} />
        <div className="overflow-x-auto rounded-xl border border-border">
          <div className="grid min-w-[44rem] grid-cols-7">
            {DAY_NAMES.map((d) => (
              <div key={d} className="border-b border-border bg-secondary/40 px-2 py-1.5 text-xs font-medium text-muted-foreground">
                {d}
              </div>
            ))}
            {days.map((d) => {
              const list = (byDay.get(d) ?? []).sort((a, b) => a.start - b.start);
              const outside = d.slice(0, 7) !== anchor.slice(0, 7);
              return (
                <div
                  key={d}
                  className={cn(
                    "min-h-[6.5rem] border-b border-r border-border p-1.5",
                    outside && "bg-background/60 text-muted-foreground",
                  )}
                >
                  <Link
                    href={href(d, "semaine")}
                    aria-label={`Voir la semaine du ${dayNum(d)} ${MONTHS[Number(d.slice(5, 7)) - 1]} (${list.length} élément(s))`}
                    className={cn(
                      "mb-1 inline-flex size-6 items-center justify-center rounded-full text-xs hover:bg-secondary",
                      d === today && "bg-brand font-semibold text-brand-foreground hover:bg-brand",
                    )}
                  >
                    {dayNum(d)}
                  </Link>
                  <ul className="space-y-0.5">
                    {list.slice(0, 3).map((e) => (
                      <li key={e.id}>
                        <button
                          type="button"
                          onClick={() => setSelected(e)}
                          className={cn(
                            "block w-full truncate rounded px-1 py-0.5 text-left text-[0.72rem] hover:ring-1 hover:ring-brand/40",
                            e.block ? "bg-secondary text-muted-foreground" : "bg-brand-100 text-foreground",
                          )}
                        >
                          <span className="tabular-nums">{e.hm}</span> {e.title}
                        </button>
                      </li>
                    ))}
                    {list.length > 3 && <li className="px-1 text-[0.7rem] text-muted-foreground">+ {list.length - 3} autres</li>}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
        {details}
      </div>
    );
  }

  // Vue semaine : colonnes par jour, lignes par heure, événements placés à l'heure exacte.
  const monday = mondayOf(anchor);
  const week = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const hours = Array.from({ length: LAST_HOUR - FIRST_HOUR }, (_, i) => FIRST_HOUR + i);
  const title = `Semaine du ${dayNum(monday)} ${MONTHS[Number(monday.slice(5, 7)) - 1]} ${monday.slice(0, 4)}`;
  return (
    <div className="space-y-3">
      <Toolbar title={title} prev={href(addDays(monday, -7))} next={href(addDays(monday, 7))} today={href(today)} />
      <div className="overflow-x-auto rounded-xl border border-border">
        <div className="grid min-w-[52rem] grid-cols-[3.5rem_repeat(7,minmax(0,1fr))]">
          <div className="border-b border-border bg-secondary/40" />
          {week.map((d, i) => (
            <div key={d} className="border-b border-l border-border bg-secondary/40 px-2 py-1.5 text-center">
              <span className="block text-xs text-muted-foreground">{DAY_NAMES[i]}</span>
              <span
                className={cn(
                  "inline-flex size-7 items-center justify-center rounded-full text-sm font-medium",
                  d === today && "bg-brand text-brand-foreground",
                )}
              >
                {dayNum(d)}
              </span>
            </div>
          ))}

          {/* Colonne des heures */}
          <div className="relative" style={{ height: hours.length * HOUR_PX }}>
            {hours.map((h, i) => (
              <span key={h} className="absolute right-1.5 -translate-y-1/2 text-[0.7rem] tabular-nums text-muted-foreground" style={{ top: i * HOUR_PX }}>
                {i === 0 ? "" : `${String(h).padStart(2, "0")}:00`}
              </span>
            ))}
          </div>

          {week.map((d) => {
            const wd = String(new Date(`${d}T12:00:00Z`).getUTCDay());
            const ranges = openHours?.[wd] ?? [];
            const list = byDay.get(d) ?? [];
            return (
              <div key={d} className="relative border-l border-border bg-muted/30" style={{ height: hours.length * HOUR_PX }}>
                {/* Heures d'ouverture : fond clair ; heures fermées : fond grisé */}
                {ranges.map(([a, b]) => {
                  const box = clampBox(minutesOf(a), minutesOf(b));
                  return box ? <div key={a} aria-hidden="true" className="absolute inset-x-0 bg-card" style={box} /> : null;
                })}
                {hours.map((h, i) => (
                  <div key={h} aria-hidden="true" className="absolute inset-x-0 border-t border-border/60" style={{ top: i * HOUR_PX }} />
                ))}
                {list.map((e) => {
                  // Un événement qui déborde de 7 h – 21 h est rogné à la grille, jamais masqué.
                  const box = clampBox(e.start, e.start + e.durationMin);
                  if (!box) return null;
                  const top = box.top;
                  const height = Math.max(20, box.height - 2);
                  const compact = height < 52;
                  return (
                    <button
                      type="button"
                      key={e.id}
                      onClick={() => setSelected(e)}
                      aria-label={`${e.hm}, ${e.title} : voir le détail`}
                      className={cn(
                        "absolute inset-x-1 overflow-hidden rounded-md px-1.5 text-left text-[0.75rem] leading-tight shadow-sm transition hover:ring-2 hover:ring-brand/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand",
                        compact ? "flex items-center gap-1 py-0" : "py-1",
                        e.block
                          ? "border border-dashed border-border bg-secondary text-muted-foreground"
                          : "border-l-[3px] border-brand bg-brand-100 text-foreground",
                      )}
                      style={{ top, height }}
                    >
                      {compact ? (
                        <span className="truncate">
                          <span className="font-semibold tabular-nums">{e.hm}</span> · {e.title}
                        </span>
                      ) : (
                        <>
                          <span className="block font-semibold tabular-nums">{e.hm}</span>
                          <span className="block truncate">{e.title}</span>
                          {!e.block && e.notes && height > 70 && <span className="block truncate text-muted-foreground">{e.notes}</span>}
                        </>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Fond clair : heures d&apos;ouverture de l&apos;agent. Bordure en pointillés : indisponibilité. Cliquez sur un rendez-vous pour voir sa fiche.
      </p>
      {details}
    </div>
  );
}

/** Fiche d'un rendez-vous : détails, résumé de l'appel, lien vers l'appel, annulation. */
function EventDetails({ event: e, canEdit, onClose }: { event: CalendarEvent; canEdit: boolean; onClose: () => void }) {
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => ev.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const start = new Date(e.startsAt);
  const end = new Date(start.getTime() + e.durationMin * 60_000);
  const fmt = (d: Date, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("fr-FR", { timeZone: e.timezone, ...o }).format(d);
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="evt-title"
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-xl"
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {e.block ? "Indisponibilité" : "Rendez-vous"}
            </p>
            <h2 id="evt-title" className="text-lg font-semibold tracking-tight">
              {e.title}
            </h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Fermer" className="inline-flex size-8 items-center justify-center rounded-lg hover:bg-secondary">
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
        <dl className="mt-4 grid grid-cols-[7rem_1fr] gap-x-3 gap-y-2 text-sm">
          <dt className="text-muted-foreground">Quand</dt>
          <dd className="capitalize">
            {fmt(start, { weekday: "long", day: "numeric", month: "long" })}, {fmt(start, { hour: "2-digit", minute: "2-digit" })} –{" "}
            {fmt(end, { hour: "2-digit", minute: "2-digit" })}
          </dd>
          {e.agentName && (
            <>
              <dt className="text-muted-foreground">Agent</dt>
              <dd>{e.agentName}</dd>
            </>
          )}
          {e.phone && (
            <>
              <dt className="text-muted-foreground">Téléphone</dt>
              <dd>
                <a href={`tel:${e.phone}`} className="inline-flex items-center gap-1.5 text-brand-400 hover:underline">
                  <Phone className="size-3.5" aria-hidden="true" /> {e.phone}
                </a>
              </dd>
            </>
          )}
          {e.notes && (
            <>
              <dt className="text-muted-foreground">{e.block ? "Motif" : "Motif du RDV"}</dt>
              <dd className="whitespace-pre-line">{e.notes}</dd>
            </>
          )}
          {!e.block && (
            <>
              <dt className="text-muted-foreground">Référence</dt>
              <dd className="font-mono">{e.reference}</dd>
            </>
          )}
          {e.synced && (
            <>
              <dt className="text-muted-foreground">Google Agenda</dt>
              <dd className="inline-flex items-center gap-1.5">
                <CalendarCheck2 className="size-3.5 text-emerald-400" aria-hidden="true" /> Synchronisé
              </dd>
            </>
          )}
        </dl>
        {!e.block && (
          <div className="mt-4 rounded-xl border border-border bg-secondary/30 p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Résumé de l&apos;appel</p>
            <p className="mt-1 text-sm">{e.summary || "Pris sans appel associé (ou résumé indisponible)."}</p>
            {e.callId && (
              <Link href={`/calls/${e.callId}`} className="mt-2 inline-block text-sm font-medium text-brand-400 hover:underline">
                Écouter l&apos;appel et lire la transcription →
              </Link>
            )}
          </div>
        )}
        {canEdit && (
          <div className="mt-4 flex justify-end">
            {e.block ? <RemoveBlockButton id={e.id} /> : <CancelAppointmentButton id={e.id} label={`${e.title}, ${e.reference}`} />}
          </div>
        )}
      </div>
    </div>
  );
}

/** Position (px) d'une plage de minutes dans la grille 7 h – 21 h ; null si entièrement dehors. */
function clampBox(startMin: number, endMin: number): { top: number; height: number } | null {
  const lo = FIRST_HOUR * 60;
  const hi = LAST_HOUR * 60;
  const a = Math.max(startMin, lo);
  const b = Math.min(endMin, hi);
  if (b <= a) return null;
  return { top: ((a - lo) / 60) * HOUR_PX, height: ((b - a) / 60) * HOUR_PX };
}

function Toolbar({ title, prev, next, today }: { title: string; prev: string; next: string; today: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link href={today} className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-secondary">
        Aujourd&apos;hui
      </Link>
      <Link href={prev} aria-label="Période précédente" className="inline-flex size-8 items-center justify-center rounded-lg hover:bg-secondary">
        <ChevronLeft className="size-4" aria-hidden="true" />
      </Link>
      <Link href={next} aria-label="Période suivante" className="inline-flex size-8 items-center justify-center rounded-lg hover:bg-secondary">
        <ChevronRight className="size-4" aria-hidden="true" />
      </Link>
      <h2 className="ml-1 text-[0.95rem] font-semibold capitalize tracking-tight">{title}</h2>
    </div>
  );
}
