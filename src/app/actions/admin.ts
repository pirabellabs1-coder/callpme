"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/client";
import { requireAdmin } from "@/lib/auth/session";
import { isPlanId } from "@/lib/billing/plans";
import { createVoice } from "@/lib/db/voices";
import {
  createPromoCode,
  togglePromoCode,
  deletePromoCode,
} from "@/lib/db/promo";
import { sendEmail, hasResend, type SendEmailResult } from "@/lib/email/resend";
import {
  announcementEmail,
  subscriptionEmail,
} from "@/lib/email/templates";
import { getPlan } from "@/lib/billing/plans";
import { buildDefaultConfig } from "@/lib/agents/build-config";
import type { AgentRole } from "@/lib/shared/types";

export interface AdminResult {
  ok?: boolean;
  error?: string;
  info?: string;
}

/* --------------------------- Demandes Agence ----------------------------- */

/** L'admin valide une demande Agence et fixe le montant (€) à payer. */
export async function quoteAgencyRequest(formData: FormData): Promise<AdminResult> {
  await requireAdmin();
  const id = String(formData.get("id") || "");
  const amount = Math.max(0, parseInt(String(formData.get("amount") || "0"), 10) || 0);
  const note = String(formData.get("note") || "").trim();
  if (!id || amount <= 0) return { error: "Montant invalide." };
  const reqRow = await prisma.agencyRequest.findUnique({ where: { id } });
  if (!reqRow) return { error: "Demande introuvable." };
  await prisma.agencyRequest.update({
    where: { id },
    data: { quotedAmountEur: amount, adminNote: note || null, status: "quoted" },
  });
  const base = process.env.PUBLIC_URL || "https://www.callpme.com";
  void sendEmail({
    to: reqRow.contactEmail,
    subject: "Votre offre Agence Callpme — montant proposé",
    html:
      `<p>Bonjour ${reqRow.contactName},</p>` +
      `<p>Votre demande d'offre Agence a été validée. Montant proposé : <b>${amount} €</b>.</p>` +
      (note ? `<p>${note.replace(/</g, "&lt;")}</p>` : "") +
      `<p>Connectez-vous à votre espace Facturation pour régler : <a href="${base}/billing">${base}/billing</a></p>`,
    text: `Votre offre Agence : ${amount} €. Réglez sur ${base}/billing`,
  }).catch(() => {});
  revalidatePath("/admin/demandes");
  return { ok: true, info: "Devis envoyé au client." };
}

/** L'admin refuse une demande Agence. */
export async function rejectAgencyRequest(id: string): Promise<AdminResult> {
  await requireAdmin();
  if (!id) return { error: "Demande invalide." };
  await prisma.agencyRequest.update({ where: { id }, data: { status: "rejected" } });
  revalidatePath("/admin/demandes");
  return { ok: true };
}

/* ----------------------------- Abonnements ------------------------------- */

export async function setOrgPlan(
  orgId: string,
  plan: string,
): Promise<AdminResult> {
  await requireAdmin();
  if (!isPlanId(plan)) return { error: "Offre inconnue." };
  await prisma.organization.update({ where: { id: orgId }, data: { plan } });

  // Informe les membres de l'organisation du changement d'offre (best-effort)
  if (hasResend()) {
    const members = await prisma.user.findMany({
      where: { organizationId: orgId },
      select: { email: true, name: true },
    });
    const planName = getPlan(plan).name;
    void Promise.allSettled(
      members.map((m) => {
        const mail = subscriptionEmail(m.name ?? "", planName);
        return sendEmail({
          to: m.email,
          subject: mail.subject,
          html: mail.html,
          text: mail.text,
        });
      }),
    ).catch(() => {});
  }

  revalidatePath("/admin/organizations");
  revalidatePath("/admin");
  return { ok: true };
}

/* ------------------------------- E-mails --------------------------------- */

export async function sendPlatformEmail(
  formData: FormData,
): Promise<AdminResult> {
  await requireAdmin();
  const target = String(formData.get("target") ?? "all").trim();
  const subject = String(formData.get("subject") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();
  if (!subject || !message) return { error: "Sujet et message requis." };
  if (!hasResend()) {
    return { error: "Resend non configuré (RESEND_API_KEY manquante)." };
  }

  let recipients: string[];
  if (target === "all") {
    const users = await prisma.user.findMany({
      select: { email: true },
      take: 50,
    });
    recipients = users.map((u) => u.email);
  } else {
    recipients = [target];
  }
  if (recipients.length === 0) return { error: "Aucun destinataire." };

  const mail = announcementEmail(subject, message);
  const results = await Promise.allSettled(
    recipients.map((to) =>
      sendEmail({ to, subject: mail.subject, html: mail.html, text: mail.text }),
    ),
  );
  const sent = results.filter(
    (r) => r.status === "fulfilled" && (r.value as SendEmailResult).ok,
  ).length;
  if (sent === 0) {
    return {
      error:
        "Aucun e-mail envoyé. Vérifiez RESEND_FROM (adresse d'un domaine vérifié).",
    };
  }
  return { ok: true, info: `${sent}/${recipients.length} e-mail(s) envoyé(s).` };
}

/* ------------------------------ Codes promo ------------------------------ */

export async function createPromo(formData: FormData): Promise<AdminResult> {
  await requireAdmin();
  const code = String(formData.get("code") ?? "").trim();
  if (!code) return { error: "Code requis." };
  const discountType = String(formData.get("discountType") ?? "percent");
  const discountValue =
    parseInt(String(formData.get("discountValue") ?? "0"), 10) || 0;
  const grantPlan = String(formData.get("grantPlan") ?? "") || null;
  const maxRedemptions =
    parseInt(String(formData.get("maxRedemptions") ?? "0"), 10) || 0;
  const description = String(formData.get("description") ?? "").trim() || undefined;

  const created = await createPromoCode({
    code,
    discountType,
    discountValue,
    grantPlan,
    maxRedemptions,
    description,
  });
  if (!created) return { error: "Ce code existe déjà." };
  revalidatePath("/admin/promos");
  return { ok: true };
}

export async function togglePromo(id: string): Promise<AdminResult> {
  await requireAdmin();
  await togglePromoCode(id);
  revalidatePath("/admin/promos");
  return { ok: true };
}

export async function deletePromo(id: string): Promise<AdminResult> {
  await requireAdmin();
  await deletePromoCode(id);
  revalidatePath("/admin/promos");
  return { ok: true };
}

/* -------------------------------- Voix ----------------------------------- */

export async function deleteVoiceAdmin(id: string): Promise<AdminResult> {
  await requireAdmin();
  await prisma.voice.delete({ where: { id } }).catch(() => {});
  revalidatePath("/admin/voices");
  return { ok: true };
}

export async function addVoiceAdmin(formData: FormData): Promise<AdminResult> {
  const session = await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const provider = String(formData.get("provider") ?? "elevenlabs");
  const voiceId = String(formData.get("voiceId") ?? "").trim();
  const gender = String(formData.get("gender") ?? "feminine");
  if (!name || !voiceId) return { error: "Nom et ID de voix requis." };

  await createVoice(session.org.id, {
    name,
    provider,
    gender,
    accent: provider,
    description: `Voix ${provider} · ID ${voiceId}`,
    settings: JSON.stringify({ externalVoiceId: voiceId }),
  });
  revalidatePath("/admin/voices");
  return { ok: true };
}

/* ---------------------------- Utilisateurs ------------------------------- */

export async function setUserAdmin(
  userId: string,
  makeAdmin: boolean,
): Promise<AdminResult> {
  const session = await requireAdmin();
  if (userId === session.user.id && !makeAdmin) {
    return { error: "Vous ne pouvez pas retirer vos propres droits admin." };
  }
  await prisma.user.update({ where: { id: userId }, data: { isAdmin: makeAdmin } });
  revalidatePath("/admin/users");
  return { ok: true };
}

export async function deleteUser(userId: string): Promise<AdminResult> {
  const session = await requireAdmin();
  if (userId === session.user.id) {
    return { error: "Vous ne pouvez pas supprimer votre propre compte ici." };
  }
  await prisma.session.deleteMany({ where: { userId } });
  await prisma.user.delete({ where: { id: userId } }).catch(() => {});
  revalidatePath("/admin/users");
  return { ok: true };
}

/* --------------------- Purge des données de démo ------------------------- */

/** Vide tout le contenu de démonstration de l'organisation (garde l'org + les comptes). */
export async function purgeDemoData(): Promise<AdminResult> {
  const session = await requireAdmin();
  const orgId = session.org.id;
  try {
    const agents = await prisma.agent.findMany({
      where: { organizationId: orgId },
      select: { id: true },
    });
    const agentIds = agents.map((a) => a.id);

    // Ordre : enfants/refs d'abord, parents ensuite.
    await prisma.call.deleteMany({ where: { agentId: { in: agentIds } } }); // évaluations en cascade
    await prisma.phoneNumber.deleteMany({ where: { organizationId: orgId } });
    await prisma.providerConnection.deleteMany({ where: { organizationId: orgId } });
    await prisma.agent.deleteMany({ where: { organizationId: orgId } });
    await prisma.campaign.deleteMany({ where: { organizationId: orgId } }); // contacts en cascade
    await prisma.knowledgeBase.deleteMany({ where: { organizationId: orgId } }); // documents en cascade
    await prisma.voice.deleteMany({ where: { organizationId: orgId } });
    await prisma.customTool.deleteMany({ where: { organizationId: orgId } });
    await prisma.client.deleteMany({ where: { organizationId: orgId } });
    await prisma.notification.deleteMany({ where: { organizationId: orgId } });
    await prisma.integration.deleteMany({ where: { organizationId: orgId } });
    await prisma.apiKey.deleteMany({ where: { organizationId: orgId } });
    await prisma.webhook.deleteMany({ where: { organizationId: orgId } });

    revalidatePath("/admin");
    revalidatePath("/overview");
    return { ok: true, info: "Données de démonstration supprimées. Votre espace est vierge." };
  } catch {
    return { error: "La purge a échoué (contrainte de données)." };
  }
}

/** Recrée un jeu de données de démonstration pour l'organisation courante. */
export async function reloadDemoData(): Promise<AdminResult> {
  const session = await requireAdmin();
  const orgId = session.org.id;
  const orgName = session.org.name;

  const existing = await prisma.agent.count({ where: { organizationId: orgId } });
  if (existing > 0) {
    return {
      error: "Des données existent déjà. Purgez d'abord pour recharger une démo propre.",
    };
  }

  const roster: { role: AgentRole; name: string }[] = [
    { role: "support", name: "Camille — Support" },
    { role: "appointment", name: "Léa — Rendez-vous" },
    { role: "outbound_sales", name: "Hugo — Ventes" },
    { role: "receptionist", name: "Standard — Accueil" },
  ];
  const statuses = ["completed", "completed", "completed", "transferred", "missed", "failed"];
  const outcomes = ["Résolu", "RDV pris", "Information donnée", "Transfert", "Message pris"];

  try {
    for (const r of roster) {
      const config = buildDefaultConfig(r.role, r.name, orgName, {
        voice: { voiceId: "amelie" },
      });
      const agent = await prisma.agent.create({
        data: {
          organizationId: orgId,
          name: r.name,
          role: r.role,
          status: "active",
          config: JSON.stringify(config),
        },
      });
      const n = 8 + Math.floor(Math.random() * 8);
      for (let i = 0; i < n; i++) {
        const status = statuses[Math.floor(Math.random() * statuses.length)];
        const created = new Date();
        created.setDate(created.getDate() - Math.floor(Math.random() * 13));
        created.setHours(9 + Math.floor(Math.random() * 9), Math.floor(Math.random() * 60), 0, 0);
        const direction =
          r.role === "outbound_sales" || Math.random() < 0.3 ? "outbound" : "inbound";
        await prisma.call.create({
          data: {
            agentId: agent.id,
            direction,
            fromNumber: "+33 6 12 34 56 78",
            toNumber: "+33 1 84 80 11 04",
            status,
            durationSec: 30 + Math.floor(Math.random() * 180),
            transcript: JSON.stringify([
              { speaker: "agent", text: config.firstMessage, at: 0 },
              { speaker: "caller", text: "Bonjour, j'ai une question.", at: 3 },
            ]),
            summary: "Appel de démonstration.",
            outcome: outcomes[Math.floor(Math.random() * outcomes.length)],
            satisfaction: status === "completed" ? 3 + Math.floor(Math.random() * 3) : null,
            createdAt: created,
          },
        });
      }
    }
    await prisma.voice.create({
      data: {
        organizationId: orgId,
        name: "Voix Accueil Premium",
        provider: "custom",
        status: "ready",
        gender: "feminine",
        accent: "Français standard",
      },
    });
    await prisma.voice.create({
      data: {
        organizationId: orgId,
        name: "Voix Commercial",
        provider: "custom",
        status: "ready",
        gender: "masculine",
        accent: "Français standard",
      },
    });

    revalidatePath("/admin");
    revalidatePath("/overview");
    return { ok: true, info: "Données de démonstration rechargées." };
  } catch {
    return { error: "Le rechargement a échoué." };
  }
}
