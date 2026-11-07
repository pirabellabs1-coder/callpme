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

import { countryInfo } from "./number-countries";
export { NUMBER_COUNTRIES, countryInfo, countryOfNumber, type NumberCountry } from "./number-countries";

export interface AvailableNumber {
  phoneNumber: string;
  locality: string | null;
  region: string | null;
}

export class NumberError extends Error {}

const SIP_NUMBERS =
  "Avec la passerelle SIP, les numéros sont fournis par votre opérateur local : déclarez-les dans « Numéros », l'équipe les active une fois raccordés.";

const NO_PLATFORM_SALES =
  "Callpme ne vend pas de numéros pour l'instant : achetez votre numéro chez votre opérateur (Twilio, Telnyx…), puis ajoutez-le dans « Numéros ».";

/**
 * Vente de numéros par la plateforme (compte opérateur de Callpme). Coupée par
 * défaut : chaque client achète son numéro chez son opérateur puis le déclare.
 * PLATFORM_NUMBER_SALES=on la rouvre (ex. numéros d'un opérateur partenaire).
 */
export function platformSellsNumbers(): boolean {
  return process.env.PLATFORM_NUMBER_SALES === "on";
}

const PURCHASE_REFUSED =
  "L'opérateur a refusé cet achat (un justificatif d'identité ou d'adresse peut être exigé pour ce pays). Contactez-nous si le problème persiste.";

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
  if (!platformSellsNumbers()) throw new NumberError(NO_PLATFORM_SALES);
  const provider = telephonyProvider();
  const country = countryInfo(opts.country);
  if (!provider) throw new NumberError("Téléphonie non configurée sur la plateforme.");
  if (provider === "sip") throw new NumberError(SIP_NUMBERS);
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
    if (!res.ok) {
      console.error("[numéros] recherche Twilio :", res.status, data.message);
      throw new NumberError("Recherche impossible pour le moment chez l'opérateur.");
    }
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
  if (!res.ok) {
    console.error("[numéros] recherche Telnyx :", res.status, data.errors?.[0]?.detail);
    throw new NumberError("Recherche impossible pour le moment chez l'opérateur.");
  }
  return (data.data ?? []).map((n) => ({
    phoneNumber: n.phone_number,
    locality: n.region_information?.find((r) => r.region_type === "location")?.region_name ?? null,
    region: n.region_information?.find((r) => r.region_type === "state")?.region_name ?? null,
  }));
}

/** Achète un numéro et le relie au moteur vocal ; renvoie la référence opérateur. */
export async function buyNumber(phoneNumber: string): Promise<{ providerRef: string; provider: "twilio" | "telnyx" }> {
  if (!platformSellsNumbers()) throw new NumberError(NO_PLATFORM_SALES);
  const provider = telephonyProvider();
  if (!provider) throw new NumberError("Téléphonie non configurée sur la plateforme.");
  if (provider === "sip") throw new NumberError(SIP_NUMBERS);
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
        // Fin d'appel : un bip raccroché avant le décroché déclenche le rappel automatique.
        StatusCallback: `${publicUrl()}/api/telephony/status`,
        StatusCallbackMethod: "POST",
        ...(process.env.TWILIO_ADDRESS_SID ? { AddressSid: process.env.TWILIO_ADDRESS_SID } : {}),
        ...(process.env.TWILIO_BUNDLE_SID ? { BundleSid: process.env.TWILIO_BUNDLE_SID } : {}),
      }),
      signal: AbortSignal.timeout(15000),
    });
    const data = (await res.json().catch(() => ({}))) as { sid?: string; message?: string };
    if (!res.ok || !data.sid) {
      console.error("[numéros] achat Twilio refusé :", res.status, data.message);
      throw new NumberError(PURCHASE_REFUSED);
    }
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
  if (!res.ok || !data.data?.id) {
    console.error("[numéros] achat Telnyx refusé :", res.status, data.errors?.[0]?.detail);
    throw new NumberError(PURCHASE_REFUSED);
  }
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
      const headers = { Authorization: `Bearer ${process.env.TELNYX_API_KEY}` };
      // La suppression se fait par identifiant de ressource : on le retrouve d'abord.
      const lookup = await fetch(
        `https://api.telnyx.com/v2/phone_numbers?${new URLSearchParams({ "filter[phone_number]": phoneNumber })}`,
        { headers, signal: AbortSignal.timeout(10000) },
      );
      if (!lookup.ok) return false;
      const found = (await lookup.json().catch(() => ({}))) as { data?: { id: string }[] };
      // Plus sur le compte : déjà rendu.
      if (!found.data?.length) return true;
      const res = await fetch(`https://api.telnyx.com/v2/phone_numbers/${encodeURIComponent(found.data[0].id)}`, {
        method: "DELETE",
        headers,
        signal: AbortSignal.timeout(10000),
      });
      return res.ok;
    }
  } catch {
    return false;
  }
  return false;
}
