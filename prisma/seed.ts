/**
 * Seed Callpme — agence de démonstration, agents multi-rôles et historique
 * d'appels réaliste (avec transcripts) pour rendre tout le dashboard vivant.
 *
 * Exécuté via `tsx` (voir package.json#prisma.seed) ou `npm run db:seed`.
 * Réutilise le vrai moteur de génération de prompt (imports relatifs).
 */
import { PrismaClient } from "@prisma/client";
import { randomBytes, createHash } from "crypto";
import { generateSystemPrompt } from "../src/lib/agents/role-templates";
import { hashPassword } from "../src/lib/auth/password";
import { ROLE_META } from "../src/lib/agents/roles";
import type {
  AgentConfig,
  AgentRole,
  AgentStatus,
  CallDirection,
  CallStatus,
  TranscriptTurn,
} from "../src/lib/shared/types";

const prisma = new PrismaClient();
const ORG_NAME = "Atelier Vocal";

/* ----------------------------- Utilitaires ------------------------------ */

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function frMobile(): string {
  return `+33 6 ${randInt(10, 99)} ${randInt(10, 99)} ${randInt(10, 99)} ${randInt(10, 99)}`;
}

/* --------------------------- Config d'agent ----------------------------- */

const FR_VOICES = ["Adélaïde", "Léon", "Margaux", "Hugo", "Clémence", "Antoine"];

function buildConfig(
  role: AgentRole,
  agentName: string,
  modelProvider: AgentConfig["model"]["provider"],
  modelId: string,
  guardrails: string[],
  persona?: string,
): AgentConfig {
  const meta = ROLE_META[role];
  const tools = meta.defaultTools;
  return {
    voice: {
      provider: "elevenlabs",
      voiceId: pick(FR_VOICES),
      language: "fr-FR",
      speed: 1,
    },
    model: { provider: modelProvider, modelId, temperature: 0.4 },
    systemPrompt: generateSystemPrompt({
      role,
      agentName,
      organizationName: ORG_NAME,
      guardrails,
      persona,
      enabledTools: tools,
      firstSpeaker: "agent",
    }),
    firstMessage: meta.firstMessage,
    firstSpeaker: "agent",
    guardrails,
    tools,
    persona,
  };
}

interface SeedAgent {
  name: string;
  role: AgentRole;
  status: AgentStatus;
  phoneNumber: string | null;
  modelProvider: AgentConfig["model"]["provider"];
  modelId: string;
  guardrails: string[];
  persona?: string;
  callVolume: number; // appels à générer sur 14 jours
}

const SEED_AGENTS: SeedAgent[] = [
  {
    name: "Camille — Support",
    role: "support",
    status: "active",
    phoneNumber: "+33 1 84 80 11 02",
    modelProvider: "openai",
    modelId: "gpt-4o",
    guardrails: [
      "Ne jamais promettre de remboursement sans validation humaine",
      "Ne jamais communiquer de données d'un autre client",
    ],
    persona:
      "Patiente et rassurante, va droit au but sans jargon technique.",
    callVolume: 26,
  },
  {
    name: "Léa — Rendez-vous",
    role: "appointment",
    status: "active",
    phoneNumber: "+33 1 84 80 11 03",
    modelProvider: "anthropic",
    modelId: "claude-sonnet-4",
    guardrails: [
      "Ne jamais réserver sans avoir vérifié la disponibilité",
      "Toujours faire confirmer la date et l'heure avant de valider",
    ],
    persona: "Chaleureuse et organisée, confirme chaque détail.",
    callVolume: 22,
  },
  {
    name: "Hugo — Ventes",
    role: "outbound_sales",
    status: "active",
    phoneNumber: "+33 1 84 80 11 04",
    modelProvider: "mistral",
    modelId: "mistral-large",
    guardrails: [
      "Respecter immédiatement toute demande de ne plus être rappelé",
      "Ne jamais exercer de pression sur une personne qui refuse",
    ],
    persona: "Enthousiaste mais respectueux, sait écouter les objections.",
    callVolume: 24,
  },
  {
    name: "Inès — Qualification",
    role: "lead_qualification",
    status: "active",
    phoneNumber: "+33 1 84 80 11 05",
    modelProvider: "openai",
    modelId: "gpt-4o-mini",
    guardrails: ["Rester bref : l'objectif est de qualifier, pas de vendre"],
    persona: "Vive et efficace, pose les bonnes questions sans détour.",
    callVolume: 18,
  },
  {
    name: "Standard — Accueil",
    role: "receptionist",
    status: "active",
    phoneNumber: "+33 1 84 80 11 00",
    modelProvider: "openai",
    modelId: "gpt-4o-mini",
    guardrails: ["Ne jamais divulguer l'agenda interne des collaborateurs"],
    persona: "Accueil professionnel et neutre, oriente rapidement.",
    callVolume: 30,
  },
  {
    name: "Enquête — Satisfaction",
    role: "survey",
    status: "paused",
    phoneNumber: null,
    modelProvider: "anthropic",
    modelId: "claude-haiku-4",
    guardrails: ["Rester strictement neutre, ne pas commenter les réponses"],
    persona: "Courtoise et discrète, ne juge jamais les réponses.",
    callVolume: 10,
  },
];

/* --------------------------- Transcripts mock --------------------------- */

function t(
  speaker: TranscriptTurn["speaker"],
  text: string,
  at: number,
  toolName?: string,
): TranscriptTurn {
  return { speaker, text, at, toolName };
}

interface TranscriptResult {
  transcript: TranscriptTurn[];
  durationSec: number;
  outcome: string;
  summary: string;
  satisfaction: number | null;
}

function completedTranscript(role: AgentRole): TranscriptResult {
  switch (role) {
    case "support":
      return {
        durationSec: randInt(95, 210),
        outcome: "Commande retrouvée",
        summary:
          "Le client demandait le suivi de sa commande. Statut confirmé (expédiée, livraison sous 2 jours).",
        satisfaction: pick([4, 5, 5, 4, 3]),
        transcript: [
          t("agent", "Bonjour, vous êtes bien au support, que puis-je faire pour vous ?", 0),
          t("caller", "Bonjour, je voulais savoir où en est ma commande.", 6),
          t("agent", "Bien sûr. Vous avez le numéro de commande sous les yeux ?", 11),
          t("caller", "Oui, c'est le 48213.", 16),
          t("tool", "lookupOrder({ orderId: \"48213\" }) → expédiée, Colissimo, 2 jours", 18, "lookupOrder"),
          t("agent", "Je regarde… Votre commande 48213 est partie, elle arrive sous deux jours ouvrés par Colissimo.", 22),
          t("caller", "Parfait, merci beaucoup.", 29),
          t("agent", "Avec plaisir. Autre chose pour vous ?", 32),
          t("caller", "Non, c'est tout.", 35),
          t("tool", "endCall({ summary: \"Suivi commande 48213 communiqué\" })", 37, "endCall"),
          t("agent", "Très bonne journée, au revoir !", 39),
        ],
      };
    case "appointment":
      return {
        durationSec: randInt(110, 230),
        outcome: "Rendez-vous pris",
        summary:
          "Prise de rendez-vous confirmée après vérification des disponibilités.",
        satisfaction: pick([5, 5, 4, 4]),
        transcript: [
          t("agent", "Bonjour, souhaitez-vous prendre, déplacer ou annuler un rendez-vous ?", 0),
          t("caller", "J'aimerais un rendez-vous la semaine prochaine.", 6),
          t("agent", "Avec plaisir. Vous préférez plutôt le matin ou l'après-midi ?", 11),
          t("caller", "Le matin si possible.", 16),
          t("tool", "checkAvailability({ date: \"2026-06-10\", partOfDay: \"matin\" }) → 9h30, 11h00", 18, "checkAvailability"),
          t("agent", "J'ai un créneau à neuf heures trente ou à onze heures, qu'est-ce qui vous convient ?", 22),
          t("caller", "Neuf heures trente, c'est parfait.", 28),
          t("agent", "Très bien. C'est à quel nom ?", 31),
          t("caller", "Madame Rossi.", 34),
          t("agent", "Je récapitule : mardi prochain, neuf heures trente, au nom de Madame Rossi. Je valide ?", 37),
          t("caller", "Oui, allez-y.", 43),
          t("tool", "bookAppointment({ name: \"Rossi\", date: \"2026-06-10\", time: \"09:30\" }) → RDV-734512", 45, "bookAppointment"),
          t("agent", "C'est noté, vous recevrez une confirmation. Très bonne journée !", 48),
        ],
      };
    case "outbound_sales":
      return {
        durationSec: randInt(80, 200),
        outcome: "Intérêt marqué",
        summary:
          "Prospect intéressé par l'offre, rappel commercial programmé et e-mail envoyé.",
        satisfaction: null,
        transcript: [
          t("agent", "Bonjour, je vous appelle au sujet de votre demande récente, vous avez deux minutes ?", 0),
          t("caller", "Euh, oui, allez-y.", 6),
          t("agent", "Je vous présente notre offre en une phrase : on automatise vos appels entrants sans changer votre numéro. Ça vous parle ?", 10),
          t("caller", "Oui, justement on a du mal à tout décrocher.", 18),
          t("agent", "C'est exactement le cas qu'on adresse. Je vous propose qu'un conseiller vous rappelle pour un essai ?", 24),
          t("caller", "D'accord, plutôt en fin de semaine.", 31),
          t("tool", "markInterested({ level: \"fort\" })", 33, "markInterested"),
          t("tool", "scheduleCallback({ when: \"vendredi 14h\" })", 35, "scheduleCallback"),
          t("agent", "Parfait, c'est calé pour vendredi quatorze heures. Je vous envoie un récapitulatif par e-mail.", 38),
          t("tool", "sendFollowUpEmail({ to: \"prospect@ex.fr\", template: \"recapitulatif\" })", 41, "sendFollowUpEmail"),
          t("agent", "Merci pour votre temps, très bonne journée !", 44),
        ],
      };
    case "lead_qualification":
      return {
        durationSec: randInt(70, 160),
        outcome: "Lead qualifié",
        summary: "Prospect qualifié (besoin clair, budget défini), enregistré au CRM.",
        satisfaction: null,
        transcript: [
          t("agent", "Bonjour et merci pour votre intérêt ! Quelques questions rapides pour vous orienter.", 0),
          t("caller", "Pas de souci.", 5),
          t("agent", "Quel est votre besoin principal, en quelques mots ?", 8),
          t("caller", "On cherche à gérer nos appels après dix-huit heures.", 13),
          t("agent", "Très clair. Vous avez une idée du budget mensuel envisagé ?", 19),
          t("caller", "Autour de trois cents euros.", 24),
          t("agent", "Et pour une mise en place, vous visez quand ?", 28),
          t("caller", "Idéalement le mois prochain.", 32),
          t("tool", "scoreLead({ need: \"appels après 18h\", budget: \"300€\", timeline: \"1 mois\" }) → 78/100 (chaud)", 34, "scoreLead"),
          t("tool", "saveToCRM({ name: \"Prospect\", notes: \"Appels soir, 300€, 1 mois\" })", 36, "saveToCRM"),
          t("agent", "Merci, c'est parfait. Un conseiller vous recontacte très vite. Bonne journée !", 39),
        ],
      };
    case "receptionist":
      return {
        durationSec: randInt(35, 90),
        outcome: "Appel orienté",
        summary: "Appel orienté vers le service commercial.",
        satisfaction: pick([4, 5, 4]),
        transcript: [
          t("agent", "Bonjour, vous êtes bien à l'accueil, comment puis-je vous orienter ?", 0),
          t("caller", "Je voudrais parler au service commercial.", 6),
          t("agent", "Bien sûr, je vous mets en relation, un instant.", 10),
          t("tool", "routeCall({ target: \"commercial\" })", 12, "routeCall"),
          t("agent", "Je vous transfère, bonne journée !", 14),
        ],
      };
    case "survey":
      return {
        durationSec: randInt(60, 130),
        outcome: "Enquête complétée",
        summary: "Enquête de satisfaction complétée, note globale 9/10.",
        satisfaction: 5,
        transcript: [
          t("agent", "Bonjour, suite à votre passage nous menons une courte enquête, vous avez une minute ?", 0),
          t("caller", "Oui, brièvement.", 5),
          t("agent", "Sur une échelle de zéro à dix, recommanderiez-vous nos services ?", 9),
          t("caller", "Neuf.", 14),
          t("tool", "recordAnswer({ questionId: \"nps\", answer: \"9\" })", 16, "recordAnswer"),
          t("agent", "Merci ! Et qu'est-ce qui a le plus compté pour vous ?", 19),
          t("caller", "La rapidité de la prise en charge.", 24),
          t("tool", "recordAnswer({ questionId: \"raison\", answer: \"rapidité\" })", 26, "recordAnswer"),
          t("tool", "submitSurvey({ score: 9 })", 28, "submitSurvey"),
          t("agent", "Merci beaucoup pour votre retour, très bonne journée !", 31),
        ],
      };
    default:
      return {
        durationSec: randInt(60, 150),
        outcome: "Demande traitée",
        summary: "L'agent a pris en charge la demande de l'appelant.",
        satisfaction: pick([4, 5, 4]),
        transcript: [
          t("agent", ROLE_META[role].firstMessage, 0),
          t("caller", "Bonjour, j'ai une demande.", 5),
          t("agent", "Bien sûr, je vous écoute et je m'en occupe.", 9),
          t("tool", "endCall({ summary: \"Demande traitée\" })", 14, "endCall"),
          t("agent", "C'est fait, très bonne journée !", 16),
        ],
      };
  }
}

function transferredTranscript(role: AgentRole): TranscriptResult {
  return {
    durationSec: randInt(40, 95),
    outcome: "Transféré à un humain",
    summary: "Demande hors périmètre, transfert vers un conseiller.",
    satisfaction: null,
    transcript: [
      t("agent", ROLE_META[role].firstMessage, 0),
      t("caller", "En fait, c'est un cas un peu particulier…", 7),
      t("agent", "Je comprends. Je préfère vous passer un conseiller qui pourra mieux vous aider.", 12),
      t("tool", "transferToHuman({ reason: \"demande spécifique hors périmètre\" })", 15, "transferToHuman"),
      t("agent", "Je vous transfère, ne quittez pas.", 17),
    ],
  };
}

function shortResult(status: CallStatus): TranscriptResult {
  if (status === "missed") {
    return {
      durationSec: 0,
      outcome: "Appel manqué",
      summary: "Appel non abouti (raccroché avant décroché).",
      satisfaction: null,
      transcript: [],
    };
  }
  return {
    durationSec: randInt(8, 30),
    outcome: "Échec technique",
    summary: "Appel interrompu pour raison technique.",
    satisfaction: null,
    transcript: [t("system", "Appel interrompu (erreur média).", 0)],
  };
}

function statusForIndex(i: number): CallStatus {
  const r = (i * 37) % 100;
  if (r < 70) return "completed";
  if (r < 82) return "transferred";
  if (r < 92) return "missed";
  return "failed";
}

function directionFor(role: AgentRole, i: number): CallDirection {
  const dir = ROLE_META[role].direction;
  if (dir === "inbound") return "inbound";
  if (dir === "outbound") return "outbound";
  return i % 2 === 0 ? "inbound" : "outbound";
}

/* ------------------------------- Exécution ------------------------------ */

async function main() {
  console.log("· Nettoyage…");
  await prisma.call.deleteMany();
  await prisma.agent.deleteMany();
  await prisma.session.deleteMany();
  await prisma.apiKey.deleteMany();
  await prisma.webhook.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organization.deleteMany();

  console.log("· Organisation + propriétaire…");
  const ownerHash = await hashPassword("demo1234");
  const org = await prisma.organization.create({
    data: {
      name: ORG_NAME,
      plan: "agency",
      users: {
        create: [
          {
            email: "contact@pirabellabs.com",
            name: "Équipe Pirabel",
            role: "owner",
            passwordHash: ownerHash,
            isAdmin: true,
          },
          {
            email: "operateur@ateliervocal.fr",
            name: "Opérateur",
            role: "member",
            passwordHash: ownerHash,
          },
        ],
      },
    },
  });

  console.log("· Clients…");
  const clientA = await prisma.client.create({
    data: {
      organizationId: org.id,
      name: "Cabinet Médical Saint-Roch",
      brandColor: "#2F6B47",
      contactEmail: "contact@saintroch.fr",
    },
  });
  const clientB = await prisma.client.create({
    data: {
      organizationId: org.id,
      name: "Boutique Lumière",
      brandColor: "#3B6FB0",
      contactEmail: "hello@lumiere.fr",
    },
  });

  console.log("· Agents…");
  let totalCalls = 0;
  let salesAgentId = "";
  for (const a of SEED_AGENTS) {
    const config = buildConfig(
      a.role,
      a.name,
      a.modelProvider,
      a.modelId,
      a.guardrails,
      a.persona,
    );
    const clientId =
      a.role === "support" || a.role === "appointment"
        ? clientA.id
        : a.role === "outbound_sales" || a.role === "lead_qualification"
          ? clientB.id
          : null;
    const agent = await prisma.agent.create({
      data: {
        clientId,
        organizationId: org.id,
        name: a.name,
        role: a.role,
        status: a.status,
        phoneNumber: a.phoneNumber,
        config: JSON.stringify(config),
      },
    });
    if (a.role === "outbound_sales") salesAgentId = agent.id;

    // Génération de l'historique d'appels sur 14 jours.
    const calls = [];
    for (let i = 0; i < a.callVolume; i++) {
      const status = statusForIndex(i + a.name.length);
      let res: TranscriptResult;
      if (status === "completed") res = completedTranscript(a.role);
      else if (status === "transferred") res = transferredTranscript(a.role);
      else res = shortResult(status);

      const daysAgo = randInt(0, 13);
      const created = new Date();
      created.setDate(created.getDate() - daysAgo);
      created.setHours(randInt(8, 19), randInt(0, 59), 0, 0);

      const dir = directionFor(a.role, i);
      calls.push({
        agentId: agent.id,
        direction: dir,
        fromNumber: dir === "inbound" ? frMobile() : (a.phoneNumber ?? "+33 1 84 80 11 00"),
        toNumber: dir === "inbound" ? (a.phoneNumber ?? "+33 1 84 80 11 00") : frMobile(),
        status,
        durationSec: res.durationSec,
        transcript: JSON.stringify(res.transcript),
        summary: res.summary,
        outcome: res.outcome,
        satisfaction: res.satisfaction,
        createdAt: created,
      });
    }
    await prisma.call.createMany({ data: calls });
    totalCalls += calls.length;
    console.log(`  ✓ ${a.name} (${a.role}) — ${calls.length} appels`);
  }

  // Clé API + webhook de démonstration
  console.log("· Clé API + webhook de démo…");
  const demoKeyRaw = `cpk_live_${randomBytes(24).toString("base64url")}`;
  await prisma.apiKey.create({
    data: {
      organizationId: org.id,
      name: "Clé de production",
      prefix: demoKeyRaw.slice(0, 13),
      lastFour: demoKeyRaw.slice(-4),
      hash: createHash("sha256").update(demoKeyRaw).digest("hex"),
    },
  });
  await prisma.webhook.create({
    data: {
      organizationId: org.id,
      url: "https://example.com/webhooks/callpme",
      events: JSON.stringify(["agent.created", "call.completed"]),
      secret: `whsec_${randomBytes(16).toString("hex")}`,
      enabled: true,
    },
  });

  // Numéros (importés depuis providers) + connexion provider + fonction perso
  console.log("· Numéros + provider + fonction personnalisée…");
  await prisma.phoneNumber.createMany({
    data: [
      { organizationId: org.id, number: "+33 1 84 80 11 00", label: "Paris · Standard", provider: "twilio", monthlyPrice: 3 },
      { organizationId: org.id, number: "+33 1 84 80 11 02", label: "Paris · Support", provider: "twilio", monthlyPrice: 3 },
      { organizationId: org.id, number: "+33 1 84 80 11 03", label: "Paris · Rendez-vous", provider: "twilio", monthlyPrice: 3 },
      { organizationId: org.id, number: "+33 1 84 80 11 04", label: "Paris · Ventes", provider: "twilio", monthlyPrice: 3 },
      { organizationId: org.id, number: "+33 1 84 80 11 05", label: "Paris · Qualification", provider: "twilio", monthlyPrice: 3 },
      { organizationId: org.id, number: "+33 9 70 80 81 82", label: "Ligne Zadarma", provider: "zadarma", monthlyPrice: 2 },
    ],
  });
  await prisma.providerConnection.create({
    data: {
      organizationId: org.id,
      provider: "twilio",
      label: "Compte Twilio principal",
      accountSid: "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      authToken: "demo",
      enabled: true,
    },
  });
  await prisma.customTool.create({
    data: {
      organizationId: org.id,
      name: "collectContact",
      label: "Collecte de contact",
      description:
        "Collecte le nom, le prénom et l'e-mail de l'appelant, puis les envoie au CRM.",
      parameters: JSON.stringify({
        type: "object",
        properties: {
          nom: { type: "string", description: "Nom de famille" },
          prenom: { type: "string", description: "Prénom" },
          email: { type: "string", description: "Adresse e-mail" },
        },
        required: ["nom", "prenom"],
      }),
      serverUrl: "https://example.com/crm/contact",
      secret: `whsec_${randomBytes(12).toString("hex")}`,
      method: "POST",
    },
  });

  // Campagne + contacts, base de connaissances, voix, notifications, intégrations
  console.log("· Campagne, connaissances, voix, notifications…");
  if (salesAgentId) {
    const campaign = await prisma.campaign.create({
      data: {
        organizationId: org.id,
        agentId: salesAgentId,
        name: "Relance clients — janvier",
        status: "draft",
      },
    });
    await prisma.contact.createMany({
      data: [
        { campaignId: campaign.id, name: "Marie Durand", phone: frMobile() },
        { campaignId: campaign.id, name: "Paul Martin", phone: frMobile() },
        { campaignId: campaign.id, name: "Sophie Lemaire", phone: frMobile() },
        { campaignId: campaign.id, name: "Julien Bernard", phone: frMobile() },
        { campaignId: campaign.id, name: "Claire Petit", phone: frMobile() },
      ],
    });
  }

  const kb = await prisma.knowledgeBase.create({
    data: {
      organizationId: org.id,
      name: "FAQ & Tarifs",
      description: "Questions fréquentes, tarifs et conditions.",
    },
  });
  await prisma.document.createMany({
    data: [
      {
        knowledgeBaseId: kb.id,
        title: "Horaires d'ouverture",
        source: "text",
        content:
          "Nous sommes ouverts du lundi au vendredi de 9h à 18h, et le samedi de 9h à 12h. Fermé les jours fériés.",
      },
      {
        knowledgeBaseId: kb.id,
        title: "Politique de retour",
        source: "text",
        content:
          "Les retours sont acceptés sous 30 jours, article non utilisé et dans son emballage d'origine. Le remboursement intervient sous 5 jours ouvrés.",
      },
    ],
  });

  await prisma.voice.createMany({
    data: [
      {
        organizationId: org.id,
        name: "Accueil Premium",
        provider: "custom",
        status: "ready",
        gender: "feminine",
        accent: "Français standard",
        description: "Chaleureuse, posée, idéale pour l'accueil.",
        sampleText: "Bonjour et bienvenue, comment puis-je vous aider ?",
      },
      {
        organizationId: org.id,
        name: "Conseiller Confiance",
        provider: "custom",
        status: "ready",
        gender: "masculine",
        accent: "Français standard",
        description: "Assuré et rassurant pour la vente.",
        sampleText: "Bonjour, je vous appelle au sujet de votre demande.",
      },
    ],
  });

  await prisma.notification.createMany({
    data: [
      { organizationId: org.id, type: "system", title: "Bienvenue sur Callpme", body: "Votre espace agence est prêt.", read: false },
      { organizationId: org.id, type: "call", title: "Nouvel appel résolu", body: "Camille — Support a traité une demande.", href: "/calls", read: false },
      { organizationId: org.id, type: "campaign", title: "Campagne prête", body: "Relance clients — janvier attend d'être lancée.", href: "/campaigns", read: true },
    ],
  });

  await prisma.integration.createMany({
    data: [
      { organizationId: org.id, provider: "google_calendar", status: "connected" },
      { organizationId: org.id, provider: "slack", status: "connected" },
    ],
  });

  console.log(`\n✅ Seed terminé : 1 org (plan agency), 2 clients, ${SEED_AGENTS.length} agents, ${totalCalls} appels.`);
  console.log("   Connexion démo : contact@pirabellabs.com / demo1234");
  console.log(`   Clé API de démo (à usage de test) : ${demoKeyRaw}`);
}

main()
  .catch((e) => {
    console.error("❌ Seed échoué :", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
