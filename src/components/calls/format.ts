/**
 * Formats de date des appels — fuseau fixe (Europe/Paris) pour que le rendu
 * serveur et l'hydratation client produisent exactement le même texte.
 */
const TZ = "Europe/Paris";

const shortFmt = new Intl.DateTimeFormat("fr-FR", {
  timeZone: TZ,
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});
const longFmt = new Intl.DateTimeFormat("fr-FR", {
  timeZone: TZ,
  dateStyle: "full",
  timeStyle: "short",
});

/** « 6 nov., 14:32 » */
export function formatCallDate(iso: string): string {
  return shortFmt.format(new Date(iso));
}

/** « jeudi 6 novembre 2026 à 14:32 » */
export function formatCallDateLong(iso: string): string {
  return longFmt.format(new Date(iso));
}

/** Horodatage de transcript « m:ss ». */
export function formatOffset(at: number): string {
  const s = Math.max(0, Math.floor(at));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
