/**
 * Diagnostic d'un numéro : tout ce qui doit marcher pour qu'il reçoive et
 * passe des appels, vérifié en direct (base, Twilio, serveur vocal, crédit),
 * avec pour chaque point ce qu'il faut corriger. Lecture seule.
 */
import { prisma } from "../db/client";
import { creditBalanceCents, OUTBOUND_MIN_MINUTES } from "../billing/credit";
import { outboundRateCents } from "../billing/outbound-rates";
import {
  checkTwilioCredentials,
  connectionCreds,
  listTwilioNumbers,
  twilioAuthHeader,
  type TwilioCreds,
} from "./twilio-accounts";

export type CheckStatus = "ok" | "warn" | "error" | "skip";

export interface DiagnosticCheck {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
  /** Que faire pour corriger (absent si tout va bien). */
  fix?: string;
}

export interface NumberDiagnostic {
  number: string;
  /** Peut recevoir des appels (aucune erreur sur les points entrants). */
  inboundReady: boolean;
  /** Peut passer des appels (aucune erreur sur les points sortants). */
  outboundReady: boolean;
  checks: DiagnosticCheck[];
}

const OUTBOUND_COUNTRIES = [
  { iso: "FR", label: "France" },
  { iso: "BJ", label: "Bénin" },
  { iso: "CI", label: "Côte d'Ivoire" },
];

const PROFILE_STATUS: Record<string, string> = {
  draft: "brouillon (pas encore soumis)",
  "pending-review": "soumis, en attente d'examen",
  "in-review": "en cours d'examen par Twilio",
  "twilio-rejected": "refusé par Twilio",
  "twilio-approved": "approuvé",
};

async function getJson(url: string, c: TwilioCreds): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  try {
    const res = await fetch(url, { headers: { Authorization: twilioAuthHeader(c) }, signal: AbortSignal.timeout(8000) });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: {} };
  }
}

/** Profil de conformité Twilio (Trust Hub) : exigé pour les appels sortants. */
export async function twilioComplianceCheck(c: TwilioCreds): Promise<DiagnosticCheck> {
  const label = "Profil de conformité Twilio (appels sortants)";
  const r = await getJson("https://trusthub.twilio.com/v1/CustomerProfiles?PageSize=20", c);
  if (!r.ok) {
    return { id: "compliance", label, status: "warn", detail: "Impossible de lire le profil de conformité chez Twilio.", fix: "Vérifiez dans la console Twilio : Trust Hub > Customer Profiles." };
  }
  const profiles = ((r.data.results as { status?: string; friendly_name?: string }[]) ?? []).map((p) => p.status ?? "");
  if (profiles.includes("twilio-approved")) return { id: "compliance", label, status: "ok", detail: "Profil approuvé par Twilio." };
  const fix =
    "Dans la console Twilio : Trust Hub > Customer Profiles, complétez et soumettez le profil (Primary Customer Profile) avec les informations de l'entreprise. Sans profil approuvé, Twilio refuse les appels sortants.";
  if (profiles.length === 0) return { id: "compliance", label, status: "error", detail: "Aucun profil de conformité sur ce compte Twilio.", fix };
  const best = ["in-review", "pending-review", "draft", "twilio-rejected"].find((s) => profiles.includes(s)) ?? profiles[0];
  const pending = best === "in-review" || best === "pending-review";
  return {
    id: "compliance",
    label,
    status: pending ? "warn" : "error",
    detail: `Profil ${PROFILE_STATUS[best] ?? best}.`,
    fix: pending ? "Attendez la validation de Twilio (souvent quelques heures à quelques jours ouvrés)." : fix,
  };
}

/** Autorisations géographiques Twilio : pays que le compte a le droit d'appeler. */
export async function twilioGeoCheck(c: TwilioCreds): Promise<DiagnosticCheck> {
  const label = "Pays autorisés en appel sortant (Twilio)";
  const results = await Promise.all(
    OUTBOUND_COUNTRIES.map(async (k) => {
      const r = await getJson(`https://voice.twilio.com/v1/DialingPermissions/Countries/${k.iso}`, c);
      return { ...k, known: r.ok, enabled: r.ok && r.data.low_risk_numbers_enabled === true };
    }),
  );
  if (results.every((x) => !x.known)) {
    return { id: "geo", label, status: "warn", detail: "Impossible de lire les autorisations géographiques.", fix: "Console Twilio : Voice > Settings > Geo permissions." };
  }
  const off = results.filter((x) => x.known && !x.enabled).map((x) => x.label);
  if (off.length === 0) return { id: "geo", label, status: "ok", detail: `Autorisés : ${results.map((x) => x.label).join(", ")}.` };
  return {
    id: "geo",
    label,
    status: "warn",
    detail: `Non autorisés : ${off.join(", ")}.`,
    fix: "Console Twilio : Voice > Settings > Geo permissions, cochez les pays que vos agents doivent appeler.",
  };
}

/** Le serveur vocal répond-il ? */
export async function voiceServerCheck(): Promise<DiagnosticCheck> {
  const label = "Moteur vocal Callpme";
  const base = (process.env.VOICE_SERVER_URL || "").replace(/^ws/, "http").replace(/\/$/, "");
  if (!base) return { id: "voice", label, status: "error", detail: "Moteur vocal non configuré sur la plateforme.", fix: "Contactez l'équipe Callpme." };
  try {
    const res = await fetch(`${base}/health`, { signal: AbortSignal.timeout(8000) });
    return res.ok
      ? { id: "voice", label, status: "ok", detail: "En ligne." }
      : { id: "voice", label, status: "error", detail: `Le moteur vocal ne répond pas correctement (HTTP ${res.status}).`, fix: "Contactez l'équipe Callpme." };
  } catch {
    return { id: "voice", label, status: "error", detail: "Le moteur vocal est injoignable.", fix: "Réessayez dans une minute ; si cela persiste, contactez l'équipe Callpme." };
  }
}

/** Diagnostic complet d'un numéro de l'organisation (null si le numéro n'est pas à elle). */
export async function diagnoseNumber(organizationId: string, numberId: string): Promise<NumberDiagnostic | null> {
  const n = await prisma.phoneNumber.findFirst({ where: { id: numberId, organizationId } });
  if (!n) return null;
  const checks: DiagnosticCheck[] = [];

  // 1. Numéro dans Callpme
  checks.push(
    n.status === "active"
      ? { id: "number", label: "Numéro actif dans Callpme", status: "ok", detail: "Actif." }
      : { id: "number", label: "Numéro actif dans Callpme", status: "error", detail: "En attente de vérification.", fix: "Importez-le depuis « Mon compte opérateur » pour qu'il soit vérifié et activé automatiquement." },
  );

  // 2. Agent relié
  const agent = await prisma.agent.findFirst({ where: { organizationId, phoneNumber: n.number }, select: { name: true, status: true } });
  checks.push(
    !agent
      ? { id: "agent", label: "Agent relié", status: "error", detail: "Aucun agent n'est relié à ce numéro.", fix: "Ouvrez un agent, étape « Téléphonie », et choisissez ce numéro." }
      : agent.status !== "active"
        ? { id: "agent", label: "Agent relié", status: "error", detail: `« ${agent.name} » n'est pas en ligne.`, fix: "Mettez l'agent « En ligne » depuis sa page." }
        : { id: "agent", label: "Agent relié", status: "ok", detail: `« ${agent.name} » est en ligne.` },
  );

  // 3. Moteur vocal
  checks.push(await voiceServerCheck());

  // 4. Compte opérateur et configuration chez Twilio
  let creds: TwilioCreds | null = null;
  if (!n.connectionId) {
    checks.push({
      id: "account",
      label: "Compte opérateur",
      status: n.provider === "sip" ? "ok" : "warn",
      detail: n.provider === "sip" ? "Numéro fourni par un opérateur partenaire de Callpme." : "Ce numéro n'est rattaché à aucun compte opérateur connecté.",
      ...(n.provider === "sip" ? {} : { fix: "Connectez votre compte Twilio dans « Mon compte opérateur », puis importez ce numéro." }),
    });
  } else {
    creds = await connectionCreds(n.connectionId, organizationId);
    const valid = creds ? await checkTwilioCredentials(creds.sid, creds.token) : { ok: false as const, error: "Identifiants illisibles." };
    if (!valid.ok) {
      checks.push({ id: "account", label: "Compte Twilio connecté", status: "error", detail: valid.error, fix: "Déconnectez puis reconnectez votre compte Twilio avec des identifiants à jour." });
      creds = null;
    } else {
      checks.push({ id: "account", label: "Compte Twilio connecté", status: "ok", detail: `Identifiants valides (${valid.name}).` });
      const owned = creds ? await listTwilioNumbers(creds).catch(() => null) : null;
      const tw = owned?.find((x) => x.phoneNumber === n.number);
      checks.push(
        !owned
          ? { id: "routing", label: "Numéro configuré vers Callpme chez Twilio", status: "warn", detail: "Impossible de lire la configuration du numéro chez Twilio." }
          : !tw
            ? { id: "routing", label: "Numéro configuré vers Callpme chez Twilio", status: "error", detail: "Ce numéro n'est plus sur votre compte Twilio.", fix: "Vérifiez dans la console Twilio qu'il n'a pas été libéré ou déplacé." }
            : !tw.linked
              ? { id: "routing", label: "Numéro configuré vers Callpme chez Twilio", status: "error", detail: "Les appels entrants de ce numéro vont ailleurs (autre service ou réglage modifié).", fix: "Dans « Mon compte opérateur », cliquez sur « Importer mes numéros » puis « Ajouter à Callpme » : la configuration est refaite automatiquement." }
              : { id: "routing", label: "Numéro configuré vers Callpme chez Twilio", status: "ok", detail: "Les appels entrants arrivent sur Callpme." },
      );
    }
  }

  // 5. Appels sortants : conformité, pays autorisés, crédit
  if (creds) {
    const [compliance, geo] = await Promise.all([twilioComplianceCheck(creds), twilioGeoCheck(creds)]);
    checks.push(compliance, geo);
  }
  const credit = await creditBalanceCents(organizationId).catch(() => 0);
  const minCents = OUTBOUND_MIN_MINUTES * outboundRateCents("+33600000000");
  checks.push(
    credit >= minCents
      ? { id: "credit", label: "Crédit d'appels sortants", status: "ok", detail: `${(credit / 100).toFixed(2)} € disponibles.` }
      : { id: "credit", label: "Crédit d'appels sortants", status: "warn", detail: `${(credit / 100).toFixed(2)} € : insuffisant pour appeler.`, fix: "Rechargez le crédit dans « Facturation » (Mobile Money ou carte)." },
  );

  const INBOUND = ["number", "agent", "voice", "account", "routing"];
  const OUTBOUND = [...INBOUND, "compliance", "credit"];
  const hasError = (ids: string[]) => checks.some((c) => ids.includes(c.id) && c.status === "error");
  const creditLow = checks.some((c) => c.id === "credit" && c.status !== "ok");
  return {
    number: n.number,
    inboundReady: !hasError(INBOUND),
    outboundReady: !hasError(OUTBOUND) && !creditLow,
    checks,
  };
}
