/** Montants affichés sur Callpme : toujours en euros, quel que soit le pays. */
const EUR = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 0, maximumFractionDigits: 2 });

export function formatEur(amount: number): string {
  return EUR.format(amount);
}
