"use server";

import { DEFAULT_COUNTRY, isCountryCode } from "@/lib/geo/countries";
import { redirect } from "next/navigation";
import { z } from "zod";
import { clientIp, isRateLimited } from "@/lib/security/rate-limit";
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
import { CHALLENGE_COOKIE, checkSecondFactor, readChallenge, setChallengeCookie } from "@/lib/auth/two-factor";
import { cookies } from "next/headers";
import { makeResetToken, verifyResetToken } from "@/lib/auth/reset-token";

const PUBLIC_URL = process.env.PUBLIC_URL || "https://www.callpme.com";

export interface AuthResult {
  /** Page où envoyer l'utilisateur après l'action. */
  next?: string;
  ok?: boolean;
  error?: string;
  /** Mot de passe correct : code de double authentification attendu. */
  twoFactor?: boolean;
  /** Défi expiré : revenir au mot de passe. */
  expired?: boolean;
}

const loginSchema = z.object({
  email: z.string().email("E-mail invalide"),
  password: z.string().min(1, "Mot de passe requis"),
});

export async function login(formData: FormData): Promise<AuthResult> {
  // 10 essais / 15 min par IP : freine le bourrage d'identifiants.
  const loginEmail = String(formData.get("email") ?? "").toLowerCase().trim();
  if (
    isRateLimited(`login:${clientIp()}`, 10, 15 * 60_000) ||
    (loginEmail && isRateLimited(`login-mail:${loginEmail}`, 10, 15 * 60_000))
  ) {
    return { error: "Trop de tentatives. Patientez quelques minutes avant de réessayer." };
  }
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
  // Double authentification : pas de session avant le code de l'application.
  if (user.twoFactorEnabled) {
    setChallengeCookie(user.id);
    return { twoFactor: true };
  }
  const token = await createSession(user.id);
  setSessionCookie(token);
  return { ok: true };
}

/** Deuxième étape de connexion : code de l'application d'authentification ou code de secours. */
export async function verifyLoginCode(formData: FormData): Promise<AuthResult> {
  const userId = readChallenge(cookies().get(CHALLENGE_COOKIE)?.value);
  if (!userId) return { error: "Session de connexion expirée. Saisissez à nouveau votre mot de passe.", expired: true };
  // 6 chiffres : on limite fortement les essais (par compte et par adresse IP).
  if (isRateLimited(`2fa:${userId}`, 5, 15 * 60_000) || isRateLimited(`2fa-ip:${clientIp()}`, 20, 15 * 60_000)) {
    return { error: "Trop de tentatives. Patientez quelques minutes avant de réessayer." };
  }
  const code = String(formData.get("code") ?? "").trim().slice(0, 20);
  if (!code) return { error: "Saisissez le code." };
  const method = await checkSecondFactor(userId, code);
  if (method === "locked") return { error: "Trop de codes erronés : la vérification est bloquée temporairement. Réessayez plus tard." };
  if (!method) return { error: "Code incorrect ou déjà utilisé." };
  cookies().delete(CHALLENGE_COOKIE);
  const token = await createSession(userId);
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
  if (isRateLimited(`register:${clientIp()}`, 5, 60 * 60_000)) return { error: "Trop de tentatives. Patientez quelques minutes avant de réessayer." };
  const parsed = registerSchema.safeParse({
    organizationName: formData.get("organizationName"),
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    plan: formData.get("plan") ?? undefined,
  });
  const countryRaw = String(formData.get("country") ?? "");
  const country = isCountryCode(countryRaw) ? countryRaw : DEFAULT_COUNTRY;
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Champs invalides." };
  }
  const email = parsed.data.email.toLowerCase().trim();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "Un compte existe déjà avec cet e-mail." };
  }
  // L'offre ne s'obtient qu'après paiement confirmé (src/lib/payments/confirm.ts) :
  // l'inscription démarre toujours en Starter ; l'offre choisie mène au paiement.
  const plan = "starter";
  const wanted = parsed.data.plan && isPlanId(parsed.data.plan) ? parsed.data.plan : null;
  const passwordHash = await hashPassword(parsed.data.password);

  const org = await prisma.organization.create({
    data: {
      name: parsed.data.organizationName.trim(),
      plan,
      country,
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

  return { ok: true, next: wanted && wanted !== "starter" ? `/billing?plan=${wanted}` : "/overview" };
}

export async function logout(): Promise<void> {
  await destroySession();
  redirect("/login");
}

/** Demande de réinitialisation : envoie un lien signé par e-mail. */
export async function requestPasswordReset(formData: FormData): Promise<AuthResult> {
  if (isRateLimited(`reset-req:${clientIp()}`, 5, 60 * 60_000)) return { error: "Trop de tentatives. Patientez quelques minutes avant de réessayer." };
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
  if (isRateLimited(`reset:${clientIp()}`, 10, 60 * 60_000)) return { error: "Trop de tentatives. Patientez quelques minutes avant de réessayer." };
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
