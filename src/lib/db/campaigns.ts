/** Dépôt « Campagnes » — appels sortants par lot. */
import { prisma } from "./client";
import { getAgentById } from "./agents";
import { placeOutboundCall, vapiConfigured } from "@/lib/telephony/vapi";

export interface CampaignRecord {
  id: string;
  name: string;
  status: string;
  agentId: string;
  agentName: string;
  total: number;
  called: number;
  completed: number;
  createdAt: string;
}

export interface ContactRecord {
  id: string;
  name: string;
  phone: string;
  status: string;
  outcome: string | null;
  calledAt: string | null;
}

export async function listCampaigns(orgId: string): Promise<CampaignRecord[]> {
  const rows = await prisma.campaign.findMany({
    where: { organizationId: orgId },
    include: {
      agent: { select: { name: true } },
      contacts: { select: { status: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((r) => {
    const total = r.contacts.length;
    return {
      id: r.id,
      name: r.name,
      status: r.status,
      agentId: r.agentId,
      agentName: r.agent.name,
      total,
      called: r.contacts.filter((c) => c.status !== "pending").length,
      completed: r.contacts.filter((c) => c.status === "completed").length,
      createdAt: r.createdAt.toISOString(),
    };
  });
}

export async function getCampaign(orgId: string, id: string) {
  const r = await prisma.campaign.findUnique({
    where: { id },
    include: {
      agent: { select: { name: true, role: true } },
      contacts: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!r || r.organizationId !== orgId) return null;
  const contacts: ContactRecord[] = r.contacts.map((c) => ({
    id: c.id,
    name: c.name,
    phone: c.phone,
    status: c.status,
    outcome: c.outcome,
    calledAt: c.calledAt ? c.calledAt.toISOString() : null,
  }));
  return {
    id: r.id,
    name: r.name,
    status: r.status,
    agentId: r.agentId,
    agentName: r.agent.name,
    createdAt: r.createdAt.toISOString(),
    contacts,
  };
}

export async function createCampaign(
  orgId: string,
  data: { name: string; agentId: string },
) {
  const agent = await prisma.agent.findFirst({
    where: { id: data.agentId, organizationId: orgId },
    select: { id: true },
  });
  if (!agent) return null;
  return prisma.campaign.create({
    data: { organizationId: orgId, name: data.name, agentId: data.agentId },
  });
}

export async function addContacts(
  orgId: string,
  campaignId: string,
  contacts: { name: string; phone: string }[],
): Promise<number> {
  const camp = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!camp || camp.organizationId !== orgId) return 0;
  const clean = contacts
    .filter((c) => c.phone?.trim())
    .slice(0, 5000)
    .map((c) => ({
      campaignId,
      name: c.name?.trim() || "Contact",
      phone: c.phone.trim(),
    }));
  if (clean.length === 0) return 0;
  await prisma.contact.createMany({ data: clean });
  return clean.length;
}

export async function setCampaignStatus(
  orgId: string,
  id: string,
  status: string,
) {
  const camp = await prisma.campaign.findUnique({ where: { id } });
  if (!camp || camp.organizationId !== orgId) return false;
  await prisma.campaign.update({ where: { id }, data: { status } });
  return true;
}

export async function deleteCampaign(orgId: string, id: string) {
  const camp = await prisma.campaign.findUnique({ where: { id } });
  if (!camp || camp.organizationId !== orgId) return false;
  await prisma.campaign.delete({ where: { id } });
  return true;
}

const OUTCOMES = [
  { outcome: "Intéressé", status: "completed", weight: 30, recordCall: true },
  { outcome: "À rappeler", status: "completed", weight: 20, recordCall: true },
  { outcome: "Pas intéressé", status: "completed", weight: 25, recordCall: true },
  { outcome: "Répondeur", status: "no_answer", weight: 15, recordCall: false },
  { outcome: "Sans réponse", status: "no_answer", weight: 10, recordCall: false },
];

function pickOutcome(seed: number) {
  const total = OUTCOMES.reduce((a, o) => a + o.weight, 0);
  let r = seed % total;
  for (const o of OUTCOMES) {
    if (r < o.weight) return o;
    r -= o.weight;
  }
  return OUTCOMES[0];
}

/**
 * Lance la campagne. Si la téléphonie réelle (Vapi) est configurée, on
 * compose VRAIMENT chaque contact en attente : l'appel est lancé via Vapi,
 * le contact passe à « calling » et son `vapiCallId` est mémorisé. Le webhook
 * de fin d'appel mettra ensuite à jour le contact (issue, statut, appel
 * enregistré dans l'historique).
 *
 * Sans téléphonie configurée, on retombe sur un dialer simulé (utile pour la
 * démo et les tests) — chaque contact reçoit une issue plausible.
 */
export async function runCampaign(orgId: string, id: string) {
  const camp = await prisma.campaign.findUnique({
    where: { id },
    include: {
      agent: { select: { id: true, organizationId: true, phoneNumber: true } },
      contacts: { where: { status: "pending" } },
    },
  });
  if (!camp || camp.organizationId !== orgId) return null;

  /* ---------------------------- Mode RÉEL (Vapi) ---------------------------- */
  if (vapiConfigured()) {
    // Charge l'agent complet (prompt, voix, modèle) — indispensable à Vapi.
    const agent = await getAgentById(camp.agentId);
    if (!agent) return null;
    const org = await prisma.organization.findUnique({
      where: { id: camp.organizationId },
      select: { name: true },
    });
    const organizationName = org?.name ?? "Callpme";
    await prisma.campaign.update({ where: { id }, data: { status: "running" } });

    let placed = 0;
    let failed = 0;
    for (const c of camp.contacts) {
      const result = await placeOutboundCall({
        agent,
        organizationName,
        toNumber: c.phone,
        metadata: { contactId: c.id, campaignId: camp.id },
      });
      if (result.ok && result.callId) {
        await prisma.contact.update({
          where: { id: c.id },
          data: {
            status: "calling",
            vapiCallId: result.callId,
            calledAt: new Date(),
          },
        });
        placed += 1;
      } else {
        await prisma.contact.update({
          where: { id: c.id },
          data: {
            status: "failed",
            outcome: result.error ?? "Appel impossible",
            calledAt: new Date(),
          },
        });
        failed += 1;
      }
    }
    return { processed: camp.contacts.length, placed, failed, real: true };
  }

  /* ------------------------- Mode SIMULÉ (démo) ----------------------------- */
  const from = camp.agent.phoneNumber ?? "+33 1 84 80 11 04";
  let calls = 0;
  for (let i = 0; i < camp.contacts.length; i++) {
    const c = camp.contacts[i];
    const o = pickOutcome(c.id.charCodeAt(0) * 7 + i * 13 + c.phone.length);
    await prisma.contact.update({
      where: { id: c.id },
      data: { status: o.status, outcome: o.outcome, calledAt: new Date() },
    });
    if (o.recordCall) {
      await prisma.call.create({
        data: {
          agentId: camp.agentId,
          direction: "outbound",
          fromNumber: from,
          toNumber: c.phone,
          status: "completed",
          durationSec: 40 + ((i * 17) % 120),
          transcript: JSON.stringify([
            { speaker: "agent", text: "Bonjour, je vous appelle au sujet de votre demande récente.", at: 0 },
            { speaker: "caller", text: "Bonjour, oui je vous écoute.", at: 5 },
            { speaker: "agent", text: "Super, je vous explique en deux mots…", at: 9 },
          ]),
          summary: `Campagne « ${camp.name} » — ${o.outcome}.`,
          outcome: o.outcome,
        },
      });
      calls += 1;
    }
  }
  await prisma.campaign.update({ where: { id }, data: { status: "completed" } });
  return { processed: camp.contacts.length, calls };
}
