/**
 * Contenus partagés des pages marketing (accueil, produit, tarifs, etc.).
 * Les offres (PLANS) sont dérivées du catalogue de facturation src/lib/billing/plans.ts.
 */

import { outboundRateEur } from "@/lib/billing/outbound-rates";
import { PLANS as BILLING_PLANS, PLAN_ORDER, UNLIMITED } from "@/lib/billing/plans";

export const MARKETS = [
  "France",
  "Belgique",
  "Suisse",
  "Québec",
  "Côte d'Ivoire",
  "Sénégal",
  "Cameroun",
  "Bénin",
  "Togo",
  "Mali",
];

export const AUDIENCES = [
  {
    key: "pme",
    tag: "PME",
    title: "Ne manquez plus un appel",
    body: "Cabinet, garage, agence immobilière ou clinique : votre agent répond le soir, le week-end et aux heures chargées. Il prend vos rendez-vous et vous envoie un résumé de chaque appel.",
    points: ["En ligne en 15 minutes", "Vous gardez votre numéro", "Paiement par Mobile Money"],
    href: "/register",
    cta: "Créer mon agent",
  },
  {
    key: "agence",
    tag: "Agences",
    title: "Proposez des agents vocaux à vos clients, sous votre marque",
    body: "Vous créez un espace par client, à vos couleurs et sur votre domaine. Vous fixez vos prix. Callpme ne vous facture que l'usage.",
    points: ["Marque blanche", "Clients illimités", "Vue multi-clients"],
    href: "/partenaires",
    cta: "Devenir partenaire",
  },
  {
    key: "dev",
    tag: "Développeurs",
    title: "Intégrez la voix à votre produit",
    body: "Créez vos agents par API, connectez vos outils par webhooks et choisissez votre LLM. Vous payez à la minute : voix, transcription et téléphonie comprises.",
    points: ["API REST et webhooks", "LLM au choix", "Événements d'appel en temps réel"],
    href: "/developpeurs",
    cta: "Découvrir l'API",
  },
];

export const CODE_SAMPLES = [
  {
    label: "cURL",
    language: "bash",
    code: `curl https://callpme.com/api/v1/agents \\
  -H "Authorization: Bearer $CALLPME_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Accueil Cabinet Diallo",
    "role": "appointment",
    "voice": { "language": "fr-FR" }
  }'`,
  },
  {
    label: "JavaScript",
    language: "typescript",
    code: `const res = await fetch("https://callpme.com/api/v1/agents", {
  method: "POST",
  headers: {
    Authorization: \`Bearer \${process.env.CALLPME_KEY}\`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    name: "Accueil Cabinet Diallo",
    role: "appointment",
    voice: { language: "fr-FR" },
  }),
});
const { data: agent } = await res.json();`,
  },
  {
    label: "Python",
    language: "python",
    code: `import os, requests

agent = requests.post(
    "https://callpme.com/api/v1/agents",
    headers={"Authorization": f"Bearer {os.environ['CALLPME_KEY']}"},
    json={
        "name": "Accueil Cabinet Diallo",
        "role": "appointment",
        "voice": {"language": "fr-FR"},
    },
).json()["data"]`,
  },
];

export const WEBHOOK_SAMPLE = [
  {
    label: "Webhook reçu",
    language: "json",
    code: `{
  "event": "call.completed",
  "data": {
    "id": "call_51a9e0",
    "agentId": "agt_8f2c1d",
    "agentName": "Accueil Cabinet Diallo",
    "durationSec": 112,
    "goalAchieved": true
  },
  "timestamp": "2026-11-05T09:42:11.000Z"
}`,
  },
];

export const STEPS = [
  { n: "01", title: "Décrivez votre activité", body: "Indiquez l'adresse de votre site. Callpme en extrait vos horaires, vos services et vos questions fréquentes." },
  { n: "02", title: "Choisissez une voix", body: "Choisissez une voix et un accent adaptés à votre marché, puis testez-la dans le navigateur." },
  { n: "03", title: "Connectez vos outils", body: "Google Agenda ou Outlook, CRM, SMS. L'agent peut agir pendant l'appel, pas seulement prendre un message." },
  { n: "04", title: "Mettez en ligne", body: "Prenez un numéro local ou renvoyez votre ligne actuelle. Chaque appel est transcrit et résumé." },
];

// Offres affichées sur le site : dérivées du catalogue de facturation
// (src/lib/billing/plans.ts), seule source de vérité pour les prix et limites.
const fmt = (n: number) => new Intl.NumberFormat("fr-FR").format(n);

export const PLANS = PLAN_ORDER.map((id) => {
  const p = BILLING_PLANS[id];
  const price = p.priceMonthly;
  return {
    id,
    name: p.name,
    tagline: p.tagline,
    price: price === null ? null : String(price),
    minutes: p.minutes >= UNLIMITED ? "Volume de minutes sur mesure" : `${fmt(p.minutes)} minutes incluses par mois`,
    features: p.features,
    highlight: Boolean(p.highlight),
  };
});

export const FAQ = [
  { q: "Mes clients sauront-ils qu'ils parlent à une IA ?", a: "Oui. L'agent se présente comme un assistant IA en début d'appel, comme l'exige l'AI Act européen." },
  { q: "Puis-je garder mon numéro actuel ?", a: "Oui. Vous activez un renvoi d'appel vers Callpme, sur toutes vos lignes ou seulement en dehors des heures d'ouverture." },
  { q: "Comment payer depuis l'Afrique ?", a: "Par Orange Money, MTN, Wave, Moov ou carte bancaire. Les prix sont fixés en euros ; aucune carte internationale n'est nécessaire." },
  { q: "Où sont stockées les données ?", a: "Dans l'Union européenne. Vous choisissez la durée de conservation des enregistrements, puis ils sont supprimés." },
  { q: "Que se passe-t-il si l'agent ne sait pas répondre ?", a: "Il transfère l'appel à la personne de votre choix ou prend un message détaillé, selon vos règles." },
];

/** Offre API (développeurs), à l'usage. */
/** Offre API : appels payés sur crédit prépayé, à partir du prix d'une minute vers un fixe français. */
export const API_PRICE = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(outboundRateEur("+33100000000"));
