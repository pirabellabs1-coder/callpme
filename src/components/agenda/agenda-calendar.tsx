"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
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
}

const DAY_NAMES = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
/** Heures affichées dans la vue semaine. */
const FIRST_HOUR = 7;
const LAST_HOUR = 21;
const HOUR_PX = 48;

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
}: {
  mode: "semaine" | "mois";
  /** Date affichée (AAAA-MM-JJ). */
  anchor: string;
  today: string;
  events: CalendarEvent[];
  /** Horaires d'ouverture (0 = dimanche … 6 = samedi) pour griser les heures fermées. */
  openHours: Partial<Record<string, TimeRange[]>> | null;
}) {
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
                <Link
                  key={d}
                  href={href(d, "semaine")}
                  className={cn(
                    "min-h-[6.5rem] border-b border-r border-border p-1.5 transition-colors hover:bg-secondary/40",
                    outside && "bg-background/60 text-muted-foreground",
                  )}
                  aria-label={`${dayNum(d)} ${MONTHS[Number(d.slice(5, 7)) - 1]} : ${list.length} élément(s)`}
                >
                  <span
                    className={cn(
                      "mb-1 inline-flex size-6 items-center justify-center rounded-full text-xs",
                      d === today && "bg-brand font-semibold text-brand-foreground",
                    )}
                  >
                    {dayNum(d)}
                  </span>
                  <ul className="space-y-0.5">
                    {list.slice(0, 3).map((e) => (
                      <li
                        key={e.id}
                        className={cn(
                          "truncate rounded px-1 py-0.5 text-[0.7rem]",
                          e.block ? "bg-secondary text-muted-foreground" : "bg-brand-100 text-foreground",
                        )}
                      >
                        <span className="tabular-nums">{e.hm}</span> {e.title}
                      </li>
                    ))}
                    {list.length > 3 && <li className="px-1 text-[0.7rem] text-muted-foreground">+ {list.length - 3} autres</li>}
                  </ul>
                </Link>
              );
            })}
          </div>
        </div>
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
                  return (
                    <div
                      key={e.id}
                      title={[`${e.hm} · ${e.title}`, e.reference, e.agentName, e.phone, e.notes].filter(Boolean).join("\n")}
                      className={cn(
                        "absolute inset-x-1 overflow-hidden rounded-md px-1.5 py-1 text-[0.72rem] leading-tight shadow-sm",
                        e.block
                          ? "border border-dashed border-border bg-secondary text-muted-foreground"
                          : "border-l-[3px] border-brand bg-brand-100 text-foreground",
                      )}
                      style={{ top, height }}
                    >
                      <span className="block font-medium tabular-nums">{e.hm}</span>
                      <span className="block truncate">{e.title}</span>
                      {!e.block && e.notes && height > 44 && <span className="block truncate text-muted-foreground">{e.notes}</span>}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Fond clair : heures d&apos;ouverture de l&apos;agent. Bordure en pointillés : indisponibilité. Survolez un rendez-vous pour ses détails.
      </p>
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
