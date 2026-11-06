/**
 * Calcul des créneaux libres — fonction pure (testée), sans base de données.
 */
import type { BookingConfig } from "../shared/types";
import { hmOf, minutesOf, weekdayOf, zonedToUtc } from "./time";

export const DEFAULT_BOOKING: BookingConfig = {
  timezone: "Europe/Paris",
  durationMin: 30,
  hours: {
    "1": [["09:00", "12:00"], ["14:00", "18:00"]],
    "2": [["09:00", "12:00"], ["14:00", "18:00"]],
    "3": [["09:00", "12:00"], ["14:00", "18:00"]],
    "4": [["09:00", "12:00"], ["14:00", "18:00"]],
    "5": [["09:00", "12:00"], ["14:00", "18:00"]],
  },
  minNoticeMin: 60,
  maxDaysAhead: 60,
  smsConfirmation: true,
};

/** Configuration complète (valeurs par défaut pour les champs absents). */
export function bookingConfig(partial?: Partial<BookingConfig> | null): BookingConfig {
  return {
    ...DEFAULT_BOOKING,
    ...(partial ?? {}),
    hours: partial?.hours ?? DEFAULT_BOOKING.hours,
  };
}

export interface BusyInterval {
  start: Date;
  end: Date;
}

export type PartOfDay = "matin" | "apres-midi" | "soir";

export interface SlotQuery {
  ymd: string;
  config: BookingConfig;
  busy: BusyInterval[];
  now: Date;
  partOfDay?: PartOfDay;
}

export interface Slot {
  hm: string;
  start: Date;
  end: Date;
}

function inPart(hm: string, part?: PartOfDay): boolean {
  if (!part) return true;
  const m = minutesOf(hm);
  if (part === "matin") return m < 12 * 60;
  if (part === "apres-midi") return m >= 12 * 60 && m < 18 * 60;
  return m >= 18 * 60;
}

/** Créneaux libres d'une journée, dans l'ordre. */
export function freeSlots({ ymd, config, busy, now, partOfDay }: SlotQuery): Slot[] {
  const ranges = config.hours[String(weekdayOf(ymd)) as keyof BookingConfig["hours"]] ?? [];
  const earliest = now.getTime() + config.minNoticeMin * 60_000;
  const latest = now.getTime() + config.maxDaysAhead * 86_400_000;
  const dur = config.durationMin;
  const slots: Slot[] = [];

  for (const [from, to] of ranges) {
    for (let t = minutesOf(from); t + dur <= minutesOf(to); t += dur) {
      const hm = hmOf(t);
      if (!inPart(hm, partOfDay)) continue;
      const start = zonedToUtc(ymd, hm, config.timezone);
      const end = new Date(start.getTime() + dur * 60_000);
      if (start.getTime() < earliest || start.getTime() > latest) continue;
      if (busy.some((b) => start < b.end && b.start < end)) continue;
      slots.push({ hm, start, end });
    }
  }
  return slots;
}

/** Le créneau demandé est-il dans les horaires (indépendamment des réservations) ? */
export function withinOpeningHours(ymd: string, hm: string, config: BookingConfig): boolean {
  const ranges = config.hours[String(weekdayOf(ymd)) as keyof BookingConfig["hours"]] ?? [];
  const t = minutesOf(hm);
  return ranges.some(([from, to]) => t >= minutesOf(from) && t + config.durationMin <= minutesOf(to));
}
