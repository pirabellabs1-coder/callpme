/**
 * Actions réelles des outils d'agent — SERVEUR uniquement.
 *
 * Chaque outil agit vraiment : agenda intégré (+ Google Agenda), fiches
 * prospects (+ HubSpot / Pipedrive), SMS, e-mail, notifications. En
 * conversation de test (`ctx.test`), les données sont marquées « test » et
 * aucun effet externe n'est déclenché (pas de SMS, d'e-mail ni de CRM).
 *
 * Les résultats sont rendus au LLM : ils doivent être exacts — jamais de
 * succès simulé que l'agent annoncerait à tort à l'appelant.
 */
import { getAgentById } from "../db/agents";
import { bookAppointment, cancelAppointment, checkAvailability } from "../agenda/service";
import { bookingConfig } from "../agenda/slots";
import { isYmd, normalizeHm, zonedToUtc } from "../agenda/time";
import { recordLead, scoreLead } from "../leads/service";
import { sendSms } from "../telephony/sms";
import { sendEmail } from "../email/resend";
import { prisma } from "../db/client";
import { containsLink, takeDailyQuota } from "../security/daily-quota";
import { addOptOut } from "../campaigns/engine";
import { checkPaymentTool, requestPaymentTool } from "../payments/merchant";
import type { ToolContext, ToolResult } from "../shared/types";

type Handler = (args: Record<string, unknown>, ctx: ToolContext) => Promise<ToolResult>;

const str = (v: unknown, max = 500): string | undefined =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined;

/** Numéro de l'appelant exploitable (pas « navigateur » / « test »). */
function callerPhone(ctx: ToolContext): string | undefined {
  return /\d{6,}/.test(ctx.callerNumber) ? ctx.callerNumber : undefined;
}

async function loadAgent(ctx: ToolContext) {
  const agent = await getAgentById(ctx.agentId);
  return agent && agent.organizationId === ctx.organizationId ? agent : null;
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Un seul e-mail de suivi par appel (évite qu'un appelant s'en serve pour spammer). */
const emailsSent = new Set<string>();

const HANDLERS: Record<string, Handler> = {
  /* ----------------------------- Téléphonie ----------------------------- */
  // Le transfert et la fin d'appel sont exécutés par le moteur vocal.
  transferToHuman: async (args) => ({
    ok: true,
    message: `Demande de transfert enregistrée (motif : ${str(args.reason) ?? "non précisé"}).`,
  }),
  endCall: async () => ({ ok: true, message: "Fin d'appel demandée." }),

  routeCall: async (args, ctx) => {
    const target = str(args.target, 120) ?? "le service concerné";
    return {
      ok: false,
      message: `Transfert direct vers ${target} indisponible : propose de prendre un message (outil takeMessage) ou de transférer à un conseiller.`,
      data: { target, callerNumber: callerPhone(ctx) ?? null },
    };
  },

  takeMessage: async (args, ctx) => {
    const message = str(args.message, 2000);
    if (!message) return { ok: false, message: "Contenu du message manquant." };
    const recipient = str(args.recipient, 120);
    const lead = await recordLead({
      organizationId: ctx.organizationId,
      agentId: ctx.agentId,
      kind: "message",
      name: str(args.name, 120),
      phone: str(args.phone, 40) ?? callerPhone(ctx),
      notes: recipient ? `Pour ${recipient} : ${message}` : message,
      callRef: ctx.callId,
      test: ctx.test,
    });
    return { ok: true, message: "Message enregistré et transmis à l'équipe.", data: { messageId: lead.id } };
  },

  sendSms: async (args, ctx) => {
    const text = str(args.text, 300);
    const to = callerPhone(ctx);
    if (!text) return { ok: false, message: "Texte du SMS manquant." };
    if (!to) return { ok: false, message: "Numéro de l'appelant inconnu : SMS impossible." };
    // Anti-hameçonnage : jamais de lien dicté pendant l'appel.
    if (containsLink(text)) return { ok: false, message: "Les SMS ne peuvent pas contenir de lien ni d'adresse web." };
    if (ctx.test) return { ok: true, message: "SMS simulé (conversation de test) : rien n'a été envoyé.", data: { test: true } };
    const org = await prisma.organization.findUnique({ where: { id: ctx.organizationId }, select: { name: true } });
    const r = await sendSms(to, `${org?.name ?? "Message"} : ${text}`, { callId: ctx.callId, organizationId: ctx.organizationId });
    return r.ok ? { ok: true, message: "SMS envoyé." } : { ok: false, message: `SMS non envoyé : ${r.error}` };
  },

  optOut: async (args, ctx) => {
    const phone = callerPhone(ctx);
    if (!phone) return { ok: false, message: "Numéro de l'appelant inconnu." };
    if (ctx.test) return { ok: true, message: "Opposition simulée (conversation de test)." };
    const done = await addOptOut(ctx.organizationId, phone, str(args.reason, 200) ?? "Demande de l'appelant");
    return done
      ? { ok: true, message: "Numéro inscrit sur la liste d'opposition : il ne sera plus appelé." }
      : { ok: false, message: "Numéro invalide : inscription impossible." };
  },

  /* ------------------------------- Agenda ------------------------------- */
  checkAvailability: async (args, ctx) => {
    const agent = await loadAgent(ctx);
    if (!agent) return { ok: false, message: "Agent introuvable." };
    const r = await checkAvailability(agent, args, { test: ctx.test });
    return { ok: r.ok, message: r.message, data: { date: r.date, slots: r.slots, nextAvailable: r.nextAvailable } };
  },

  bookAppointment: async (args, ctx) => {
    const agent = await loadAgent(ctx);
    if (!agent) return { ok: false, message: "Agent introuvable." };
    const r = await bookAppointment(agent, args, { callerNumber: callerPhone(ctx), callRef: ctx.callId, test: ctx.test });
    if (r.ok) {
      // La fiche contact est complétée en même temps (sans doublon).
      await recordLead({
        organizationId: ctx.organizationId,
        agentId: ctx.agentId,
        name: str(args.name, 120),
        phone: callerPhone(ctx),
        email: str(args.email, 200),
        notes: `Rendez-vous ${r.reference}${str(args.notes) ? ` — ${str(args.notes)}` : ""}`,
        callRef: ctx.callId,
        test: ctx.test,
      }).catch(() => {});
    }
    return {
      ok: r.ok,
      message: r.message,
      data: { reference: r.reference, alternatives: r.alternatives },
    };
  },

  cancelAppointment: async (args, ctx) => {
    const r = await cancelAppointment(
      ctx.organizationId,
      { reference: args.reference, name: args.name },
      { callerNumber: callerPhone(ctx), test: ctx.test, callRef: ctx.callId },
    );
    return { ok: r.ok, message: r.message, data: { reference: r.reference } };
  },

  /* -------------------------------- CRM --------------------------------- */
  saveToCRM: async (args, ctx) => {
    const lead = await recordLead({
      organizationId: ctx.organizationId,
      agentId: ctx.agentId,
      name: str(args.name, 120),
      // Fiche rattachée au numéro réel de l'appelant ; un autre numéro dicté va en note.
      phone: callerPhone(ctx) ?? str(args.phone, 40),
      email: str(args.email, 200),
      notes: [str(args.notes, 2000), callerPhone(ctx) && str(args.phone, 40) ? `Autre numéro donné : ${str(args.phone, 40)}` : null]
        .filter(Boolean)
        .join(" — ") || null,
      callRef: ctx.callId,
      test: ctx.test,
    });
    return { ok: true, message: `Fiche de ${lead.name} enregistrée.`, data: { contactId: lead.id } };
  },

  scoreLead: async (args, ctx) => {
    const score = scoreLead({ need: str(args.need), budget: str(args.budget), timeline: str(args.timeline) });
    const temperature = score >= 70 ? "chaud" : score >= 40 ? "tiède" : "froid";
    await recordLead({
      organizationId: ctx.organizationId,
      agentId: ctx.agentId,
      name: str(args.name, 120),
      phone: callerPhone(ctx),
      score,
      notes: [str(args.need) && `Besoin : ${str(args.need)}`, str(args.budget) && `Budget : ${str(args.budget)}`, str(args.timeline) && `Échéance : ${str(args.timeline)}`]
        .filter(Boolean)
        .join(" · "),
      callRef: ctx.callId,
      test: ctx.test,
    });
    return { ok: true, message: `Prospect qualifié : ${score}/100 (${temperature}).`, data: { score, temperature } };
  },

  scheduleCallback: async (args, ctx) => {
    const agent = await loadAgent(ctx);
    const when = str(args.when, 40) ?? "";
    const [d, t] = when.replace("T", " ").split(/\s+/);
    const hm = normalizeHm(t);
    const tz = bookingConfig(agent?.config.booking).timezone;
    const callbackAt = isYmd(d) && hm ? zonedToUtc(d, hm, tz) : null;
    const phone = str(args.phone, 40) ?? callerPhone(ctx);
    if (!phone) return { ok: false, message: "Numéro à rappeler manquant : demande-le à l'appelant." };
    await recordLead({
      organizationId: ctx.organizationId,
      agentId: ctx.agentId,
      kind: "callback",
      name: str(args.name, 120),
      phone,
      notes: [str(args.reason), callbackAt ? null : `Moment souhaité : ${when}`].filter(Boolean).join(" — ") || null,
      callbackAt,
      callRef: ctx.callId,
      test: ctx.test,
    });
    return { ok: true, message: `Rappel planifié (${when}). L'équipe est prévenue.` };
  },

  markInterested: async (args, ctx) => {
    const level = (["faible", "moyen", "fort"] as const).find((l) => l === args.level) ?? "moyen";
    await recordLead({
      organizationId: ctx.organizationId,
      agentId: ctx.agentId,
      name: str(args.name, 120),
      phone: callerPhone(ctx),
      interest: level,
      callRef: ctx.callId,
      test: ctx.test,
    });
    return { ok: true, message: `Intérêt « ${level} » enregistré.` };
  },

  /* ------------------------------ Commerce ------------------------------ */
  lookupOrder: async (args) => ({
    ok: false,
    message:
      "Aucun système de commandes n'est connecté : impossible de consulter la commande. Propose de prendre un message (takeMessage) pour qu'un conseiller rappelle.",
    data: { orderId: str(args.orderId, 60) ?? null },
  }),

  createTicket: async (args, ctx) => {
    const subject = str(args.subject, 200);
    if (!subject) return { ok: false, message: "Objet du ticket manquant." };
    const priority = (["basse", "normale", "haute", "urgente"] as const).find((p) => p === args.priority) ?? "normale";
    const lead = await recordLead({
      organizationId: ctx.organizationId,
      agentId: ctx.agentId,
      kind: "ticket",
      name: str(args.name, 120),
      phone: callerPhone(ctx),
      notes: `[${priority}] ${subject}${str(args.details) ? ` — ${str(args.details, 1500)}` : ""}`,
      callRef: ctx.callId,
      test: ctx.test,
    });
    return { ok: true, message: `Ticket créé (priorité ${priority}). L'équipe est prévenue.`, data: { ticketId: lead.id } };
  },

  /* ------------------------------ Paiement ------------------------------ */
  requestPayment: requestPaymentTool,
  checkPayment: checkPaymentTool,

  /* --------------------------- Communication ---------------------------- */
  sendFollowUpEmail: async (args, ctx) => {
    const to = str(args.to, 200)?.toLowerCase();
    const summary = str(args.summary, 2000);
    if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return { ok: false, message: "Adresse e-mail invalide : fais-la épeler." };
    if (!summary) return { ok: false, message: "Récapitulatif manquant." };
    if (containsLink(summary)) return { ok: false, message: "Le récapitulatif ne peut pas contenir de lien ni d'adresse web." };
    if (ctx.test) return { ok: true, message: `E-mail simulé (conversation de test) vers ${to} : rien n'a été envoyé.` };
    if (emailsSent.has(ctx.callId)) return { ok: false, message: "Un e-mail a déjà été envoyé pendant cet appel." };
    emailsSent.add(ctx.callId);
    if (emailsSent.size > 5000) emailsSent.clear();
    if (!(await takeDailyQuota(ctx.organizationId, "email"))) {
      return { ok: false, message: "Plafond quotidien d'e-mails atteint : propose de prendre un message." };
    }
    const org = await prisma.organization.findUnique({ where: { id: ctx.organizationId }, select: { name: true } });
    const from = org?.name ?? "Votre interlocuteur";
    const notice = `Vous recevez cet e-mail à la suite de votre appel avec l'assistant de ${from}. Si vous n'êtes pas à l'origine de cet appel, ignorez ce message.`;
    const r = await sendEmail({
      to,
      subject: `${from} — récapitulatif de votre appel`,
      html:
        `<p>Bonjour,</p><p>${escapeHtml(summary).replace(/\n/g, "<br>")}</p><p>${escapeHtml(from)}</p>` +
        `<p style="color:#888;font-size:12px">${escapeHtml(notice)}</p>`,
      text: `Bonjour,\n\n${summary}\n\n${from}\n\n${notice}`,
    });
    return r.ok ? { ok: true, message: `E-mail envoyé à ${to}.` } : { ok: false, message: "E-mail non envoyé (service indisponible)." };
  },

  // Notes conservées dans la transcription de l'appel (visible dans sa fiche).
  logCall: async (args) => ({ ok: true, message: `Issue notée : ${str(args.outcome, 200) ?? "non précisée"}.` }),
  recordAnswer: async (args) => ({
    ok: true,
    message: `Réponse notée (${str(args.questionId, 60) ?? "question"}) : ${str(args.answer, 300) ?? ""}`,
  }),
  submitSurvey: async (args) => ({
    ok: true,
    message: `Enquête clôturée${typeof args.score === "number" ? ` (score ${args.score})` : ""}.`,
  }),
};

/** Exécute un outil intégré ; `null` si l'outil n'existe pas. */
export async function runBuiltinTool(
  name: string,
  args: Record<string, unknown>,
  ctx: ToolContext,
): Promise<ToolResult | null> {
  const handler = HANDLERS[name];
  if (!handler) return null;
  try {
    return await handler(args ?? {}, ctx);
  } catch (e) {
    console.error(`[tools] ${name} :`, e instanceof Error ? e.message : e);
    return { ok: false, message: "Action impossible pour le moment (erreur technique). Propose de prendre un message." };
  }
}
