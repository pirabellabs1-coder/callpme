"use client";

import type { BookingConfig, TimeRange } from "@/lib/shared/types";
import { bookingConfig } from "@/lib/agenda/slots";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

const TIMEZONES = [
  ["Europe/Paris", "France (Paris)"],
  ["Europe/Brussels", "Belgique (Bruxelles)"],
  ["Europe/Zurich", "Suisse (Zurich)"],
  ["America/Toronto", "Québec / Ontario"],
  ["Africa/Abidjan", "Côte d'Ivoire (Abidjan)"],
  ["Africa/Dakar", "Sénégal (Dakar)"],
  ["Africa/Douala", "Cameroun (Douala)"],
  ["Africa/Porto-Novo", "Bénin (Porto-Novo)"],
  ["Africa/Lome", "Togo (Lomé)"],
  ["Africa/Bamako", "Mali (Bamako)"],
] as const;

// Lundi en premier, comme dans un agenda français.
const DAYS = [
  ["1", "Lundi"],
  ["2", "Mardi"],
  ["3", "Mercredi"],
  ["4", "Jeudi"],
  ["5", "Vendredi"],
  ["6", "Samedi"],
  ["0", "Dimanche"],
] as const;

type DayKey = (typeof DAYS)[number][0];

const timeInput =
  "h-9 w-[7.25rem] rounded-md border border-input bg-card px-2 text-sm tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/15";

/** Horaires d'ouverture, durée des rendez-vous, fuseau et confirmation SMS. */
export function BookingSettings({
  value,
  onChange,
}: {
  value: BookingConfig | null;
  onChange: (v: BookingConfig) => void;
}) {
  const cfg = bookingConfig(value);
  const set = (patch: Partial<BookingConfig>) => onChange({ ...cfg, ...patch });
  const setDay = (day: DayKey, ranges: TimeRange[] | undefined) => {
    const hours = { ...cfg.hours };
    if (ranges && ranges.length) hours[day] = ranges;
    else delete hours[day];
    set({ hours });
  };

  return (
    <fieldset className="space-y-4 rounded-xl border border-border p-4">
      <legend className="px-1 text-sm font-medium text-foreground">Agenda de l&apos;agent</legend>
      <p className="text-xs text-muted-foreground">
        L&apos;agent ne proposera que des créneaux libres dans ces horaires. Si Google Agenda est connecté, vos
        événements y sont aussi pris en compte.
      </p>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="bk-tz">Fuseau horaire</Label>
          <Select id="bk-tz" value={cfg.timezone} onChange={(e) => set({ timezone: e.target.value })}>
            {TIMEZONES.map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bk-dur">Durée d&apos;un rendez-vous</Label>
          <Select id="bk-dur" value={cfg.durationMin} onChange={(e) => set({ durationMin: Number(e.target.value) })}>
            {[15, 20, 30, 45, 60, 90, 120].map((m) => (
              <option key={m} value={m}>
                {m < 60 ? `${m} min` : `${m / 60} h${m % 60 ? ` ${m % 60}` : ""}`}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="bk-notice">Délai minimum</Label>
          <Select id="bk-notice" value={cfg.minNoticeMin} onChange={(e) => set({ minNoticeMin: Number(e.target.value) })}>
            <option value={0}>Aucun</option>
            <option value={60}>1 heure</option>
            <option value={180}>3 heures</option>
            <option value={1440}>24 heures</option>
            <option value={2880}>48 heures</option>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">Horaires d&apos;ouverture</p>
        <ul className="divide-y divide-border rounded-lg border border-border">
          {DAYS.map(([day, label]) => {
            const ranges = cfg.hours[day] ?? [];
            const open = ranges.length > 0;
            const morning = ranges[0];
            const afternoon = ranges[1];
            const update = (i: 0 | 1, part: 0 | 1, v: string) => {
              const next: TimeRange[] = ranges.map((r) => [...r] as TimeRange);
              if (!next[i]) next[i] = i === 0 ? ["09:00", "12:00"] : ["14:00", "18:00"];
              next[i][part] = v;
              setDay(day, next);
            };
            return (
              <li key={day} className="flex items-start gap-3 px-3 py-2.5">
                <span className="pt-1">
                <Switch
                  id={`bk-day-${day}`}
                  checked={open}
                  onCheckedChange={(on) => setDay(day, on ? [["09:00", "12:00"], ["14:00", "18:00"]] : undefined)}
                  aria-label={`${label} : ${open ? "ouvert" : "fermé"}`}
                />
                </span>
                <span className="w-20 shrink-0 pt-1.5 text-sm">{label}</span>
                {open ? (
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1.5 text-sm text-muted-foreground">
                    <input type="time" aria-label={`${label}, début du matin`} className={timeInput} value={morning?.[0] ?? ""} onChange={(e) => update(0, 0, e.target.value)} />
                    <span aria-hidden="true">–</span>
                    <input type="time" aria-label={`${label}, fin du matin`} className={timeInput} value={morning?.[1] ?? ""} onChange={(e) => update(0, 1, e.target.value)} />
                    {afternoon ? (
                      <>
                        <span className="px-1">puis</span>
                        <input type="time" aria-label={`${label}, début de l'après-midi`} className={timeInput} value={afternoon[0]} onChange={(e) => update(1, 0, e.target.value)} />
                        <span aria-hidden="true">–</span>
                        <input type="time" aria-label={`${label}, fin de l'après-midi`} className={timeInput} value={afternoon[1]} onChange={(e) => update(1, 1, e.target.value)} />
                        <button type="button" className="text-xs underline-offset-4 hover:underline" onClick={() => setDay(day, [ranges[0]])}>
                          Journée continue
                        </button>
                      </>
                    ) : (
                      <button type="button" className="text-xs underline-offset-4 hover:underline" onClick={() => setDay(day, [ranges[0], ["14:00", "18:00"]])}>
                        Ajouter une coupure
                      </button>
                    )}
                  </div>
                ) : (
                  <span className="pt-1.5 text-sm text-muted-foreground">Fermé</span>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <div className="flex items-start gap-3">
        <Switch
          id="bk-sms"
          checked={cfg.smsConfirmation}
          onCheckedChange={(v) => set({ smsConfirmation: v })}
          aria-label="SMS de confirmation"
        />
        <div>
          <Label htmlFor="bk-sms">SMS de confirmation</Label>
          <p className="text-xs text-muted-foreground">
            L&apos;appelant reçoit la date, l&apos;heure et la référence de son rendez-vous.
          </p>
        </div>
      </div>
    </fieldset>
  );
}
