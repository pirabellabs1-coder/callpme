/**
 * Lecture d'un fichier de contacts (CSV, séparateur ; , ou tabulation) —
 * fonction pure, utilisée côté navigateur et testée.
 *
 * - Avec une ligne d'en-tête : colonnes reconnues automatiquement (nom,
 *   prénom, téléphone…) ; les autres colonnes deviennent des variables
 *   utilisables par l'agent ({montant}, {date_rdv}…).
 * - Sans en-tête : « nom ; téléphone » ou « téléphone ; nom ».
 */

export interface CsvContact {
  name: string;
  phone: string;
  data: Record<string, string>;
}

export interface CsvIssue {
  line: number;
  text: string;
  reason: string;
}

export interface CsvResult {
  valid: CsvContact[];
  issues: CsvIssue[];
  duplicates: number;
  /** Colonnes reconnues (affichées pour vérification). */
  mapping: { name: string | null; firstName: string | null; phone: string | null; extra: string[] } | null;
}

const phoneDigits = (p: string) => p.replace(/[\s.\-()]/g, "");
export const isPhone = (p: string) => /^(\+|00)?\d{6,15}$/.test(phoneDigits(p));
export const phoneKey = (p: string) => phoneDigits(p).replace(/^00/, "+");

const norm = (h: string) =>
  h
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");

const PHONE_HEADERS = ["telephone", "tel", "phone", "mobile", "portable", "numero", "phone_number", "gsm", "contact"];
const NAME_HEADERS = ["nom", "name", "nom_complet", "full_name", "client", "societe", "entreprise", "raison_sociale"];
const FIRST_HEADERS = ["prenom", "first_name", "firstname"];

/** Découpe une ligne CSV (guillemets « "a;b" » respectés). */
export function splitCsvLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else quoted = !quoted;
    } else if (ch === sep && !quoted) {
      out.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

function detectSeparator(line: string): string {
  const counts = [";", ",", "\t"].map((s) => ({ s, n: splitCsvLine(line, s).length }));
  return counts.sort((a, b) => b.n - a.n)[0].s;
}

export function parseContactsCsv(raw: string, existingPhones: Set<string> = new Set()): CsvResult {
  const lines = raw.replace(/^﻿/, "").split(/\r?\n/);
  const firstIdx = lines.findIndex((l) => l.trim());
  const valid: CsvContact[] = [];
  const issues: CsvIssue[] = [];
  const seen = new Set(existingPhones);
  let duplicates = 0;
  if (firstIdx < 0) return { valid, issues, duplicates, mapping: null };

  const sep = detectSeparator(lines[firstIdx]);
  const header = splitCsvLine(lines[firstIdx], sep).map(norm);
  const hasHeader = header.some((h) => [...PHONE_HEADERS, ...NAME_HEADERS, ...FIRST_HEADERS].includes(h)) && !header.some((h) => isPhone(h));

  let mapping: CsvResult["mapping"] = null;
  let phoneCol = -1;
  let nameCol = -1;
  let firstCol = -1;
  if (hasHeader) {
    phoneCol = header.findIndex((h) => PHONE_HEADERS.includes(h));
    nameCol = header.findIndex((h) => NAME_HEADERS.includes(h));
    firstCol = header.findIndex((h) => FIRST_HEADERS.includes(h));
    const used = new Set([phoneCol, nameCol, firstCol]);
    mapping = {
      phone: phoneCol >= 0 ? header[phoneCol] : null,
      name: nameCol >= 0 ? header[nameCol] : null,
      firstName: firstCol >= 0 ? header[firstCol] : null,
      extra: header.filter((h, i) => !used.has(i) && h),
    };
  }

  lines.forEach((rawLine, idx) => {
    const line = rawLine.trim();
    if (!line || (hasHeader && idx === firstIdx)) return;
    const parts = splitCsvLine(line, sep);

    let name = "";
    let phone = "";
    const data: Record<string, string> = {};
    if (hasHeader) {
      phone = phoneCol >= 0 ? parts[phoneCol] ?? "" : parts.find(isPhone) ?? "";
      const first = firstCol >= 0 ? parts[firstCol] ?? "" : "";
      const last = nameCol >= 0 ? parts[nameCol] ?? "" : "";
      name = [first, last].filter(Boolean).join(" ");
      if (first) data.prenom = first;
      header.forEach((h, i) => {
        if (i !== phoneCol && i !== nameCol && i !== firstCol && h && parts[i]) data[h] = parts[i].slice(0, 200);
      });
    } else if (parts.length === 1) phone = parts[0];
    else if (isPhone(parts[0]) && !isPhone(parts[1])) {
      phone = parts[0];
      name = parts[1];
    } else {
      name = parts[0];
      phone = parts[1];
    }

    // En-tête non reconnue (« nom;téléphone ») : ignorée silencieusement.
    if (!hasHeader && idx === firstIdx && !/\d/.test(phone)) return;
    if (!phone) return void issues.push({ line: idx + 1, text: line, reason: "numéro manquant" });
    if (!isPhone(phone)) return void issues.push({ line: idx + 1, text: line, reason: "numéro invalide" });
    const key = phoneKey(phone);
    if (seen.has(key)) {
      duplicates += 1;
      return;
    }
    seen.add(key);
    valid.push({ name: (name || "Contact").slice(0, 120), phone: phone.replace(/\s+/g, " "), data });
  });

  return { valid, issues, duplicates, mapping };
}
