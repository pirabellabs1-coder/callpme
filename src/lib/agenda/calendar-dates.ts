/** Dates de calendrier « AAAA-MM-JJ » (sans fuseau) : décalage et début de semaine. */

/** « AAAA-MM-JJ » décalé de n jours. */
export function addDays(ymd: string, n: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** Lundi de la semaine d'une date. */
export function mondayOf(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 = dimanche
  return addDays(ymd, wd === 0 ? -6 : 1 - wd);
}
