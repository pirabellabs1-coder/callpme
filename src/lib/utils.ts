import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Fusionne des classes Tailwind de façon sûre (gère les conflits).
 * Utilisé dans tous les composants UI.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Formate une durée en secondes vers un format lisible "2 min 14 s". */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds} s`;
  const min = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest === 0 ? `${min} min` : `${min} min ${rest} s`;
}

/** Formate un nombre selon la locale française (espaces fines, etc.). */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat("fr-FR").format(value);
}

/** Formate un pourcentage avec une décimale optionnelle. */
export function formatPercent(value: number, decimals = 0): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "percent",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value / 100);
}

/** Initiales à partir d'un nom (max 2 lettres). */
export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}
