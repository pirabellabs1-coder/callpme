/** Montants affichés sur Callpme : toujours en euros, quel que soit le pays. */
const EUR = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 0, maximumFractionDigits: 2 });

export function formatEur(amount: number): string {
  return EUR.format(amount);
}

const EUR_PRECISE = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 3 });

/** Prix unitaire (à la minute) : jusqu'à 3 décimales, sans arrondi trompeur. */
export function formatEurPrecise(amount: number): string {
  return EUR_PRECISE.format(amount);
}
