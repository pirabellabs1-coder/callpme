"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { createSession, destroySession, isOrgAdmin, requireSession, setSessionCookie } from "@/lib/auth/session";
import { hashPassword } from "@/lib/auth/password";
import { clientIp, isRateLimited } from "@/lib/security/rate-limit";
import { takeDailyQuota } from "@/lib/security/daily-quota";
import { sendEmail } from "@/lib/email/resend";
import { invitationEmail } from "@/lib/email/templates";
import { canGrant, canManage, findPendingInvitation, INVITE_TTL_MS, newInviteToken } from "@/lib/team/invitations";

export interface TeamResult {
  ok?: boolean;
  error?: string;
  /** Lien d'invitation (à copier si l'e-mail n'arrive pas). */
  link?: string;
  emailSent?: boolean;
}

const PUBLIC_URL = process.env.PUBLIC_URL || "http://localhost:3000";
const TOO_MANY = "Trop de tentatives. Patientez quelques minutes avant de réessayer.";

const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email("Adresse e-mail invalide.").max(160),
  role: z.enum(["admin", "member"]),
});

/** Invite une personne dans l'organisation (propriétaire ou administrateur). */
export async function inviteMember(formData: FormData): Promise<TeamResult> {
  const session = await requireSession();
  if (!isOrgAdmin(session)) return { error: "Seul un administrateur peut inviter des membres." };
  if (isRateLimited(`invite:${session.user.id}`, 20, 60 * 60_000)) return { error: TOO_MANY };
  const parsed = inviteSchema.safeParse({ email: formData.get("email"), role: formData.get("role") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Données invalides." };
  const { email, role } = parsed.data;
  if (!canGrant(session.user.role, role)) return { error: "Seul le propriétaire peut inviter un administrateur." };

  // Un compte appartient à une seule organisation.
  if (await prisma.user.findUnique({ where: { email }, select: { id: true } })) {
    return { error: "Cette adresse est déjà utilisée par un compte Callpme." };
  }
  if (!(await takeDailyQuota(session.org.id, "invite"))) {
    return { error: "Limite d'invitations atteinte pour aujourd'hui. Réessayez demain." };
  }

  const { token, tokenHash } = newInviteToken();
  await prisma.$transaction([
    // Une seule invitation en attente par adresse : la précédente est remplacée.
    prisma.invitation.deleteMany({ where: { organizationId: session.org.id, email, acceptedAt: null } }),
    prisma.invitation.create({
      data: {
        organizationId: session.org.id,
        email,
        role,
        tokenHash,
        invitedById: session.user.id,
        expiresAt: new Date(Date.now() + INVITE_TTL_MS),
      },
    }),
  ]);

  const link = `${PUBLIC_URL}/invitation/${token}`;
  const mail = invitationEmail({ inviterName: session.user.name ?? session.user.email, orgName: session.org.name, role, link });
  const sent = await sendEmail({ to: email, subject: mail.subject, html: mail.html, text: mail.text }).catch(() => null);
  revalidatePath("/settings");
  // Le lien n'est montré à l'invitant que si l'e-mail n'a pas pu partir (à transmettre lui-même).
  const emailSent = sent?.ok === true;
  return { ok: true, emailSent, link: emailSent ? undefined : link };
}

/** Annule une invitation en attente. */
export async function revokeInvitation(id: string): Promise<TeamResult> {
  const session = await requireSession();
  if (!isOrgAdmin(session)) return { error: "Action réservée aux administrateurs." };
  await prisma.invitation.deleteMany({ where: { id: String(id), organizationId: session.org.id, acceptedAt: null } });
  revalidatePath("/settings");
  return { ok: true };
}

/** Change le rôle d'un membre (propriétaire uniquement pour les administrateurs). */
export async function changeMemberRole(userId: string, role: string): Promise<TeamResult> {
  const session = await requireSession();
  const target = await prisma.user.findFirst({
    where: { id: String(userId), organizationId: session.org.id },
    select: { id: true, role: true },
  });
  if (!target) return { error: "Membre introuvable." };
  if (!canManage(session.user, target) || !canGrant(session.user.role, role)) {
    return { error: "Vous ne pouvez pas modifier le rôle de cette personne." };
  }
  await prisma.user.update({ where: { id: target.id }, data: { role } });
  if (role === "member") await prisma.invitation.deleteMany({ where: { invitedById: target.id, acceptedAt: null } });
  // Les droits changent : la personne se reconnecte.
  await prisma.session.deleteMany({ where: { userId: target.id } });
  revalidatePath("/settings");
  return { ok: true };
}

/** Retire un membre : son compte et ses sessions sont supprimés. */
export async function removeMember(userId: string): Promise<TeamResult> {
  const session = await requireSession();
  const target = await prisma.user.findFirst({
    where: { id: String(userId), organizationId: session.org.id },
    select: { id: true, role: true },
  });
  if (!target) return { error: "Membre introuvable." };
  if (!canManage(session.user, target)) return { error: "Vous ne pouvez pas retirer cette personne." };
  // Ses invitations en attente tombent avec lui.
  await prisma.invitation.deleteMany({ where: { invitedById: target.id, acceptedAt: null } });
  await prisma.user.delete({ where: { id: target.id } });
  revalidatePath("/settings");
  return { ok: true };
}

const acceptSchema = z.object({
  token: z.string().min(30).max(80),
  name: z.string().trim().min(1, "Votre nom est requis.").max(80),
  password: z.string().min(8, "8 caractères minimum.").max(200),
});

/** Accepte une invitation : crée le compte dans l'organisation et ouvre la session. */
export async function acceptInvitation(formData: FormData): Promise<TeamResult> {
  if (isRateLimited(`invite-accept:${clientIp()}`, 10, 60 * 60_000)) return { error: TOO_MANY };
  const parsed = acceptSchema.safeParse({
    token: formData.get("token"),
    name: formData.get("name"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Données invalides." };
  const inv = await findPendingInvitation(parsed.data.token);
  if (!inv) return { error: "Cette invitation n'est plus valable. Demandez-en une nouvelle." };
  if (await prisma.user.findUnique({ where: { email: inv.email }, select: { id: true } })) {
    return { error: "Un compte existe déjà avec cette adresse. Connectez-vous." };
  }
  const passwordHash = await hashPassword(parsed.data.password);
  let userId: string;
  try {
    userId = await prisma.$transaction(async (tx) => {
      // Usage unique, même si le lien est ouvert deux fois en même temps.
      const claimed = await tx.invitation.updateMany({
        where: { id: inv.id, acceptedAt: null, expiresAt: { gt: new Date() } },
        data: { acceptedAt: new Date() },
      });
      if (claimed.count !== 1) throw new Error("used");
      const user = await tx.user.create({
        data: { email: inv.email, name: parsed.data.name, passwordHash, role: inv.role, organizationId: inv.organizationId },
      });
      return user.id;
    });
  } catch {
    return { error: "Cette invitation n'est plus valable. Demandez-en une nouvelle." };
  }
  // Une session d'un autre compte ouverte dans ce navigateur est fermée et remplacée.
  await destroySession();
  setSessionCookie(await createSession(userId));
  return { ok: true };
}
