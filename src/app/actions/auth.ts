"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import {
  createSession,
  setSessionCookie,
  destroySession,
} from "@/lib/auth/session";
import { isPlanId } from "@/lib/billing/plans";
import { sendEmail } from "@/lib/email/resend";
import { welcomeEmail } from "@/lib/email/templates";
import { makeResetToken, verifyResetToken } from "@/lib/auth/reset-token";

const PUBLIC_URL = process.env.PUBLIC_URL || "https://www.callpme.com";

export interface AuthResult {
  ok?: boolean;
  error?: string;
}

const loginSchema = z.object({
  email: z.string().email("E-mail invalide"),
  password: z.string().min(1, "Mot de passe requis"),
});

export async function login(formData: FormData): Promise<AuthResult> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: "E-mail ou mot de passe invalide." };
  }
  const email = parsed.data.email.toLowerCase().trim();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    return { error: "Identifiants incorrects." };
  }
  const token = await createSession(user.id);
  setSessionCookie(token);
  return { ok: true };
}

const registerSchema = z.object({
  organizationName: z.string().min(2, "Nom d'organisation trop court"),
  name: z.string().min(1, "Nom requis"),
  email: z.string().email("E-mail invalide"),
  password: z.string().min(8, "8 caractères minimum"),
  plan: z.string().optional(),
});

export async function register(formData: FormData): Promise<AuthResult> {
  const parsed = registerSchema.safeParse({
    organizationName: formData.get("organizationName"),
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    plan: formData.get("plan") ?? undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Champs invalides." };
  }
  const email = parsed.data.email.toLowerCase().trim();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "Un compte existe déjà avec cet e-mail." };
  }
  const plan =
    parsed.data.plan && isPlanId(parsed.data.plan) ? parsed.data.plan : "starter";
  const passwordHash = await hashPassword(parsed.data.password);

  const org = await prisma.organization.create({
    data: {
      name: parsed.data.organizationName.trim(),
      plan,
      users: {
        create: {
          email,
          name: parsed.data.name.trim(),
          passwordHash,
          role: "owner",
        },
      },
    },
    include: { users: true },
  });

  const token = await createSession(org.users[0].id);
  setSessionCookie(token);

  // E-mail de bienvenue (best-effort, ne bloque pas l'inscription)
  const wel = welcomeEmail(
    parsed.data.name.trim(),
    parsed.data.organizationName.trim(),
  );
  void sendEmail({
    to: email,
    subject: wel.subject,
    html: wel.html,
    text: wel.text,
  }).catch(() => {});

  return { ok: true };
}

export async function logout(): Promise<void> {
  await destroySession();
  redirect("/login");
}

/** Demande de réinitialisation : envoie un lien signé par e-mail. */
export async function requestPasswordReset(formData: FormData): Promise<AuthResult> {
  const email = String(formData.get("email") || "").toLowerCase().trim();
  if (!email || !email.includes("@")) return { error: "E-mail invalide." };
  const user = await prisma.user.findUnique({ where: { email } });
  // On répond toujours « ok » pour ne pas divulguer l'existence d'un compte.
  if (user) {
    const link = `${PUBLIC_URL}/reinitialiser-mot-de-passe?token=${makeResetToken(user.id)}`;
    const html =
      `<p>Bonjour,</p><p>Vous avez demandé à réinitialiser votre mot de passe Callpme. ` +
      `Ce lien est valable 1 heure :</p>` +
      `<p><a href="${link}" style="color:#E8572A;font-weight:600">Réinitialiser mon mot de passe</a></p>` +
      `<p style="color:#666;font-size:13px">Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.</p>`;
    void sendEmail({
      to: email,
      subject: "Réinitialisation de votre mot de passe Callpme",
      html,
      text: `Réinitialisez votre mot de passe : ${link}`,
    }).catch(() => {});
  }
  return { ok: true };
}

/** Réinitialise le mot de passe à partir d'un jeton valide. */
export async function resetPassword(formData: FormData): Promise<AuthResult> {
  const token = String(formData.get("token") || "");
  const password = String(formData.get("password") || "");
  if (password.length < 8) return { error: "8 caractères minimum." };
  const userId = verifyResetToken(token);
  if (!userId) return { error: "Lien invalide ou expiré. Refaites une demande." };
  try {
    const passwordHash = await hashPassword(password);
    await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    // Invalide les sessions existantes par sécurité.
    await prisma.session.deleteMany({ where: { userId } });
  } catch {
    return { error: "Réinitialisation impossible." };
  }
  return { ok: true };
}
