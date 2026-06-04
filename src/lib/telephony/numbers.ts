/**
 * Inventaire de numéros (mock). En production, alimenté par l'API Twilio.
 * Certains numéros correspondent au seed (déjà assignés) pour illustrer
 * l'état « occupé » dans l'UI.
 */
export interface InventoryNumber {
  number: string;
  label: string;
  country: string;
  region: string;
  monthlyPrice: number;
}

export const NUMBER_INVENTORY: InventoryNumber[] = [
  { number: "+33 1 84 80 11 00", label: "Paris · Île-de-France", country: "FR", region: "01", monthlyPrice: 3 },
  { number: "+33 1 84 80 11 02", label: "Paris · Île-de-France", country: "FR", region: "01", monthlyPrice: 3 },
  { number: "+33 1 84 80 11 03", label: "Paris · Île-de-France", country: "FR", region: "01", monthlyPrice: 3 },
  { number: "+33 1 84 80 11 04", label: "Paris · Île-de-France", country: "FR", region: "01", monthlyPrice: 3 },
  { number: "+33 1 84 80 11 05", label: "Paris · Île-de-France", country: "FR", region: "01", monthlyPrice: 3 },
  { number: "+33 4 28 29 30 31", label: "Lyon · Rhône", country: "FR", region: "04", monthlyPrice: 3 },
  { number: "+33 5 56 12 34 56", label: "Bordeaux · Gironde", country: "FR", region: "05", monthlyPrice: 3 },
  { number: "+33 9 70 71 72 73", label: "Non géographique", country: "FR", region: "09", monthlyPrice: 2 },
  { number: "+33 9 70 80 81 82", label: "Non géographique", country: "FR", region: "09", monthlyPrice: 2 },
  { number: "+32 2 320 00 11", label: "Bruxelles", country: "BE", region: "02", monthlyPrice: 4 },
];

export function findNumber(n: string): InventoryNumber | undefined {
  return NUMBER_INVENTORY.find((x) => x.number === n);
}
