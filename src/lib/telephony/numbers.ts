/**
 * Numéros de téléphone achetés via la plateforme (compte Twilio ou Telnyx de
 * Callpme) : recherche, achat, libération. Un numéro acheté ici est relié
 * d'office au moteur vocal (appels entrants vers /api/telephony/inbound).
 *
 * Certains pays (France, Belgique, Suisse…) exigent un dossier réglementaire
 * (identité, adresse) chez l'opérateur : sans lui, l'achat est refusé et le
 * message de l'opérateur est renvoyé tel quel.
 */
import { telephonyProvider } from "./provider";

export interface NumberCountry {
  code: string;
  label: string;
  /** Prix mensuel indicatif facturé au client, en euros. */
  monthlyEur: number;
  types: ("local" | "mobile" | "tollfree")[];
}

/** Pays proposés (marchés de Callpme). Prix indicatifs, à ajuster selon l'opérateur. */
export const NUMBER_COUNTRIES: NumberCountry[] = [
  { code: "FR", label: "France", monthlyEur: 3, types: ["local", "mobile"] },
  { code: "BE", label: "Belgique", monthlyEur: 3, types: ["local", "mobile"] },
  { code: "CH", label: "Suisse", monthlyEur: 5, types: ["local"] },
  { code: "CA", label: "Canada (Québec)", monthlyEur: 2, types: ["local", "tollfree"] },
  { code: "US", label: "États-Unis", monthlyEur: 2, types: ["local", "tollfree"] },
  { code: "CI", label: "Côte d'Ivoire", monthlyEur: 15, types: ["local"] },
  { code: "SN", label: "Sénégal", monthlyEur: 15, types: ["local"] },
];

export function countryInfo(code: string): NumberCountry | undefined {
  return NUMBER_COUNTRIES.find((c) => c.code === code);
}

export interface AvailableNumber {
  phoneNumber: string;
  locality: string | null;
  region: string | null;
}

export class NumberError extends Error {}

function publicUrl(): string {
  return (process.env.PUBLIC_URL || "http://localhost:3000").replace(/\/$/, "");
}

function twilioAuth(): { sid: string; header: string } {
  const sid = process.env.TWILIO_ACCOUNT_SID!;
  return { sid, header: `Basic ${Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64")}` };
}

const TWILIO_TYPE = { local: "Local", mobile: "Mobile", tollfree: "TollFree" } as const;

/** Numéros disponibles à l'achat (20 au plus). */
export async function searchNumbers(opts: {
  country: string;
  type: "local" | "mobile" | "tollfree";
  contains?: string;
}): Promise<AvailableNumber[]> {
  const provider = telephonyProvider();
  const country = countryInfo(opts.country);
  if (!provider) throw new NumberError("Téléphonie non configurée sur la plateforme.");
  if (!country || !country.types.includes(opts.type)) throw new NumberError("Pays ou type de numéro non proposé.");
  const contains = (opts.contains ?? "").replace(/[^\d]/g, "").slice(0, 8);

  if (provider === "twilio") {
    const { sid, header } = twilioAuth();
    const q = new URLSearchParams({ PageSize: "20", VoiceEnabled: "true", ...(contains ? { Contains: contains } : {}) });
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/AvailablePhoneNumbers/${country.code}/${TWILIO_TYPE[opts.type]}.json?${q}`,
      { headers: { Authorization: header }, signal: AbortSignal.timeout(10000) },
    );
    const data = (await res.json().catch(() => ({}))) as {
      available_phone_numbers?: { phone_number: string; locality?: string; region?: string }[];
      message?: string;
    };
    if (!res.ok) throw new NumberError(data.message || `Recherche refusée par l'opérateur (HTTP ${res.status}).`);
    return (data.available_phone_numbers ?? []).map((n) => ({ phoneNumber: n.phone_number, locality: n.locality || null, region: n.region || null }));
  }

  const q = new URLSearchParams({
    "filter[country_code]": country.code,
    "filter[phone_number_type]": opts.type === "tollfree" ? "toll_free" : opts.type,
    "filter[features][]": "voice",
    "filter[limit]": "20",
    ...(contains ? { "filter[phone_number][contains]": contains } : {}),
  });
  const res = await fetch(`https://api.telnyx.com/v2/available_phone_numbers?${q}`, {
    headers: { Authorization: `Bearer ${process.env.TELNYX_API_KEY}` },
    signal: AbortSignal.timeout(10000),
  });
  const data = (await res.json().catch(() => ({}))) as {
    data?: { phone_number: string; region_information?: { region_type: string; region_name: string }[] }[];
    errors?: { detail?: string }[];
  };
  if (!res.ok) throw new NumberError(data.errors?.[0]?.detail || `Recherche refusée par l'opérateur (HTTP ${res.status}).`);
  return (data.data ?? []).map((n) => ({
    phoneNumber: n.phone_number,
    locality: n.region_information?.find((r) => r.region_type === "location")?.region_name ?? null,
    region: n.region_information?.find((r) => r.region_type === "state")?.region_name ?? null,
  }));
}

/** Achète un numéro et le relie au moteur vocal ; renvoie la référence opérateur. */
export async function buyNumber(phoneNumber: string): Promise<{ providerRef: string; provider: "twilio" | "telnyx" }> {
  const provider = telephonyProvider();
  if (!provider) throw new NumberError("Téléphonie non configurée sur la plateforme.");
  const inbound = `${publicUrl()}/api/telephony/inbound`;

  if (provider === "twilio") {
    const { sid, header } = twilioAuth();
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/IncomingPhoneNumbers.json`, {
      method: "POST",
      headers: { Authorization: header, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        PhoneNumber: phoneNumber,
        VoiceUrl: inbound,
        VoiceMethod: "POST",
        ...(process.env.TWILIO_ADDRESS_SID ? { AddressSid: process.env.TWILIO_ADDRESS_SID } : {}),
        ...(process.env.TWILIO_BUNDLE_SID ? { BundleSid: process.env.TWILIO_BUNDLE_SID } : {}),
      }),
      signal: AbortSignal.timeout(15000),
    });
    const data = (await res.json().catch(() => ({}))) as { sid?: string; message?: string };
    if (!res.ok || !data.sid) throw new NumberError(data.message || `Achat refusé par l'opérateur (HTTP ${res.status}).`);
    return { providerRef: data.sid, provider };
  }

  const res = await fetch("https://api.telnyx.com/v2/number_orders", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.TELNYX_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      phone_numbers: [{ phone_number: phoneNumber }],
      // L'application TeXML de la plateforme reçoit les appels entrants.
      connection_id: process.env.TELNYX_TEXML_APP_ID,
    }),
    signal: AbortSignal.timeout(15000),
  });
  const data = (await res.json().catch(() => ({}))) as { data?: { id?: string }; errors?: { detail?: string }[] };
  if (!res.ok || !data.data?.id) throw new NumberError(data.errors?.[0]?.detail || `Achat refusé par l'opérateur (HTTP ${res.status}).`);
  return { providerRef: data.data.id, provider };
}

/** Rend un numéro acheté via la plateforme (fin de la facturation chez l'opérateur). */
export async function releaseNumber(provider: string, providerRef: string, phoneNumber: string): Promise<boolean> {
  try {
    if (provider === "twilio" && process.env.TWILIO_ACCOUNT_SID) {
      const { sid, header } = twilioAuth();
      const res = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${sid}/IncomingPhoneNumbers/${encodeURIComponent(providerRef)}.json`,
        { method: "DELETE", headers: { Authorization: header }, signal: AbortSignal.timeout(10000) },
      );
      return res.ok || res.status === 404;
    }
    if (provider === "telnyx" && process.env.TELNYX_API_KEY) {
      const res = await fetch(`https://api.telnyx.com/v2/phone_numbers/${encodeURIComponent(phoneNumber)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${process.env.TELNYX_API_KEY}` },
        signal: AbortSignal.timeout(10000),
      });
      return res.ok || res.status === 404;
    }
  } catch {
    return false;
  }
  return false;
}
