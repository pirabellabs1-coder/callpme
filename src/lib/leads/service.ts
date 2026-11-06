/**
 * Prospects, messages, rappels et tickets collectés pendant les appels.
 * Enregistrés dans Callpme (source de vérité), puis notifiés et poussés
 * vers les CRM connectés et les webhooks — sauf en conversation de test.
 */
import { orgCountry } from "../geo/org-country";
import { prisma } from "../db/client";
import { createNotification } from "../db/notifications";
import { dispatchEvent } from "../webhooks/dispatch";
import { pushLeadToCrms, type CrmIds } from "../integrations/crm";
import { toE164 } from "../telephony/e164";

export type LeadKind = "lead" | "message" | "callback" | "ticket";

export interface LeadInput {
  organizationId: string;
  agentId?: string | null;
  kind?: LeadKind;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
  score?: number | null;
  interest?: string | null;
  callbackAt?: Date | null;
  callRef?: string | null;
  test?: boolean;
}

const KIND_TITLE: Record<LeadKind, string> = {
  lead: "Nouveau prospect",
  message: "Nouveau message",
  callback: "Rappel à faire",
  ticket: "Nouveau ticket",
};

function cleanEmail(e?: string | null): string | null {
  const v = e?.trim().toLowerCase();
  return v && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) && v.length <= 200 ? v : null;
}

function clip(s: string | null | undefined, n: number): string | null {
  const v = s?.trim();
  return v ? v.slice(0, n) : null;
}

/**
 * Crée ou complète une fiche. Un prospect (« lead ») d'un même numéro est
 * complété plutôt que dupliqué ; messages, rappels et tickets sont toujours créés.
 */
export async function recordLead(input: LeadInput) {
  const kind = input.kind ?? "lead";
  const phone = input.phone ? toE164(input.phone, await orgCountry(input.organizationId)) ?? clip(input.phone, 40) : null;
  const data = {
    name: clip(input.name, 120) ?? "Appelant",
    phone,
    email: cleanEmail(input.email),
    notes: clip(input.notes, 2000),
    score: input.score ?? null,
    interest: clip(input.interest, 20),
    callbackAt: input.callbackAt ?? null,
  };

  const existing =
    kind === "lead" && phone
      ? await prisma.lead.findFirst({
          where: { organizationId: input.organizationId, phone, kind: "lead", isTest: Boolean(input.test) },
          orderBy: { createdAt: "desc" },
        })
      : null;

  const lead = existing
    ? await prisma.lead.update({
        where: { id: existing.id },
        data: {
          // Une fiche existante n'est jamais écrasée : on complète seulement les vides.
          ...(input.name && existing.name === "Appelant" ? { name: data.name } : {}),
          ...(data.email && !existing.email ? { email: data.email } : {}),
          ...(data.notes ? { notes: [existing.notes, data.notes].filter(Boolean).join("\n").slice(-4000) } : {}),
          ...(data.score != null ? { score: data.score } : {}),
          ...(data.interest ? { interest: data.interest } : {}),
          ...(data.callbackAt ? { callbackAt: data.callbackAt } : {}),
        },
      })
    : await prisma.lead.create({
        data: {
          organizationId: input.organizationId,
          agentId: input.agentId ?? null,
          kind,
          isTest: Boolean(input.test),
          callRef: input.callRef ?? null,
          ...data,
        },
      });

  if (!input.test) {
    // Effets externes en tâche de fond : l'appelant n'attend pas les CRM.
    void (async () => {
      if (!existing) {
        await createNotification(input.organizationId, {
          type: "call",
          title: `${KIND_TITLE[kind]} : ${lead.name}`,
          body: [lead.phone, lead.notes].filter(Boolean).join(" — ").slice(0, 300),
          href: "/leads",
        }).catch(() => {});
        await dispatchEvent(input.organizationId, "lead.created", {
          id: lead.id,
          kind,
          name: lead.name,
          phone: lead.phone,
          email: lead.email,
          notes: lead.notes,
          callbackAt: lead.callbackAt?.toISOString() ?? null,
        }).catch(() => {});
      }
      if (kind === "lead") {
        let known: CrmIds = {};
        try {
          known = JSON.parse(lead.externalIds ?? "{}");
        } catch {
          /* ignoré */
        }
        const ids = await pushLeadToCrms(input.organizationId, lead, known).catch(() => known);
        if (JSON.stringify(ids) !== JSON.stringify(known)) {
          await prisma.lead.update({ where: { id: lead.id }, data: { externalIds: JSON.stringify(ids) } }).catch(() => {});
        }
      }
    })();
  }
  return lead;
}

/** Score simple et explicable (besoin, budget, échéance). */
export function scoreLead(args: { need?: string; budget?: string; timeline?: string }): number {
  let score = 0;
  if (args.need && args.need.trim().length > 3) score += 40;
  if (args.budget && /\d|budget|euros?|€|fcfa|k\b/i.test(args.budget)) score += 30;
  else if (args.budget) score += 10;
  const t = (args.timeline ?? "").toLowerCase();
  if (/(aujourd|demain|semaine|urgent|imm[ée]diat|ce mois)/.test(t)) score += 30;
  else if (/(mois|trimestre|bient[ôo]t)/.test(t)) score += 20;
  else if (t) score += 5;
  return Math.min(100, score);
}
