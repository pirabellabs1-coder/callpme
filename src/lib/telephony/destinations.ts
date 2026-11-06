/**
 * Destinations autorisées pour les appels sortants réels.
 *
 * Les appels sortants sont payés par la plateforme : on les limite aux pays
 * couverts par l'offre (cahier des charges, phase 1) et on refuse les numéros
 * surtaxés connus. Élargir cette liste au fil de l'ouverture des marchés.
 */
const ALLOWED_PREFIXES: { prefix: string; country: string }[] = [
  { prefix: "33", country: "France" },
  { prefix: "32", country: "Belgique" },
  { prefix: "41", country: "Suisse" },
  { prefix: "1", country: "Canada / États-Unis" },
  { prefix: "225", country: "Côte d'Ivoire" },
  { prefix: "221", country: "Sénégal" },
  { prefix: "237", country: "Cameroun" },
  { prefix: "229", country: "Bénin" },
  { prefix: "228", country: "Togo" },
  { prefix: "223", country: "Mali" },
];

/** Numéros spéciaux / surtaxés refusés (préfixes après l'indicatif pays). */
const BLOCKED_PREFIXES = [
  "338", // France : numéros 08 (services, surtaxés)
  "3336", // France : 3xxx courts surtaxés (forme internationale)
  "1900", // Amérique du Nord : surtaxés
  "1976",
  // Indicatif +1 hors États-Unis / Canada (Caraïbes, Pacifique) : tarifs élevés,
  // cibles classiques de fraude (IRSF, « SMS pumping »).
  ...["242", "246", "264", "268", "284", "340", "345", "441", "473", "649", "658", "664", "670", "671", "684",
    "721", "758", "767", "784", "787", "809", "829", "849", "868", "869", "876", "939"].map((c) => `1${c}`),
];

export interface DestinationCheck {
  ok: boolean;
  reason?: string;
}

/** Vérifie qu'un numéro (format E.164 de préférence) est une destination autorisée. */
export function checkDestination(raw: string): DestinationCheck {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/[^\d+]/g, "");
  if (!digits.startsWith("+")) {
    return { ok: false, reason: "Numéro au format international requis (ex. +33 6 12 34 56 78)." };
  }
  const n = digits.slice(1);
  if (n.length < 8 || n.length > 15) return { ok: false, reason: "Numéro invalide." };
  if (BLOCKED_PREFIXES.some((p) => n.startsWith(p))) {
    return { ok: false, reason: "Les numéros spéciaux ou surtaxés ne sont pas autorisés." };
  }
  if (!ALLOWED_PREFIXES.some((p) => n.startsWith(p.prefix))) {
    return { ok: false, reason: "Pays de destination non couvert pour le moment." };
  }
  return { ok: true };
}
