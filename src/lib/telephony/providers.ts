/**
 * Catalogue des opérateurs téléphoniques supportés (données pures, client-safe).
 */
import type { TelephonyProvider } from "../shared/types";

export interface ProviderInfo {
  id: TelephonyProvider;
  label: string;
  note: string;
  /** Champs d'identifiants à saisir pour connecter le compte. */
  credentials: { key: "accountSid" | "authToken" | "apiKey" | "apiSecret"; label: string }[];
}

export const TELEPHONY_PROVIDERS: ProviderInfo[] = [
  {
    id: "twilio",
    label: "Twilio",
    note: "Standard mondial, large couverture",
    credentials: [
      { key: "accountSid", label: "Account SID" },
      { key: "authToken", label: "Auth Token" },
    ],
  },
  {
    id: "zadarma",
    label: "Zadarma",
    note: "Opérateur européen économique",
    credentials: [
      { key: "apiKey", label: "Clé API" },
      { key: "apiSecret", label: "Secret API" },
    ],
  },
  {
    id: "vonage",
    label: "Vonage",
    note: "Ex-Nexmo, robuste",
    credentials: [
      { key: "apiKey", label: "API Key" },
      { key: "apiSecret", label: "API Secret" },
    ],
  },
  {
    id: "ovh",
    label: "OVHcloud Telecom",
    note: "Souverain, hébergé en France",
    credentials: [
      { key: "apiKey", label: "Application Key" },
      { key: "apiSecret", label: "Application Secret" },
    ],
  },
  {
    id: "telnyx",
    label: "Telnyx",
    note: "Faible latence, voix HD",
    credentials: [{ key: "apiKey", label: "Clé API" }],
  },
];

export const PROVIDER_LABELS: Record<string, string> = Object.fromEntries(
  TELEPHONY_PROVIDERS.map((p) => [p.id, p.label]),
);
PROVIDER_LABELS.manual = "Manuel";

export function providerLabel(id: string): string {
  return PROVIDER_LABELS[id] ?? id;
}
