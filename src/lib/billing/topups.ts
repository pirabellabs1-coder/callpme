/**
 * Recharges de minutes : achetées en Mobile Money, elles s'ajoutent à
 * l'offre et ne sont consommées qu'une fois les minutes de l'offre épuisées.
 * Elles restent acquises d'un mois sur l'autre. Module pur.
 */
export interface MinutePack {
  id: string;
  minutes: number;
  priceEur: number;
  label: string;
}

export const MINUTE_PACKS: MinutePack[] = [
  { id: "m100", minutes: 100, priceEur: 9, label: "100 minutes" },
  { id: "m500", minutes: 500, priceEur: 39, label: "500 minutes" },
  { id: "m2000", minutes: 2000, priceEur: 139, label: "2 000 minutes" },
];

export function getPack(id: string): MinutePack | undefined {
  return MINUTE_PACKS.find((p) => p.id === id);
}

/**
 * Minutes de recharge consommées par un appel : seulement la partie de
 * l'appel qui dépasse les minutes incluses dans l'offre.
 */
export function extraMinutesConsumed(usedBefore: number, callMinutes: number, included: number): number {
  const overBefore = Math.max(0, usedBefore - included);
  const overAfter = Math.max(0, usedBefore + callMinutes - included);
  return overAfter - overBefore;
}
