"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import QRCode from "qrcode";
import { prisma } from "@/lib/db/client";
import { CLIENT_COOKIE, getClientSession, getSession, SESSION_COOKIE } from "@/lib/auth/session";
import { redirect } from "next/navigation";

/** Utilisateur connecté : tableau de bord ou portail client (chacun son cookie). */
async function currentUser(): Promise<{ user: { id: string; email: string; name: string | null }; cookie: string }> {
  const s = await getSession();
  if (s) return { user: s.user, cookie: SESSION_COOKIE };
  const c = await getClientSession();
  if (c) return { user: c.user, cookie: CLIENT_COOKIE };
  redirect("/login");
}
import { verifyPassword } from "@/lib/auth/password";
import { decryptSecret, encryptSecret } from "@/lib/crypto/secrets";
import { generateBackupCodes, generateTotpSecret, otpauthUri, verifyTotp } from "@/lib/auth/totp";
import { checkSecondFactor } from "@/lib/auth/two-factor";
import { isRateLimited } from "@/lib/security/rate-limit";
import { sendEmail } from "@/lib/email/resend";
import { twoFactorEmail } from "@/lib/email/templates";

export interface TwoFactorResult {
  ok?: boolean;
  error?: string;
  /** Activation : QR code (image) et clé à saisir à la main. */
  qr?: string;
  secret?: string;
  /** Codes de secours, montrés une seule fois. */
  backupCodes?: string[];
}

const TOO_MANY = "Trop de tentatives. Patientez quelques minutes avant de réessayer.";

function notify(email: string, name: string | null, enabled: boolean) {
  const mail = twoFactorEmail(name ?? "", enabled);
  void sendEmail({ to: email, subject: mail.subject, html: mail.html, text: mail.text }).catch(() => {});
}

/** Étape 1 : nouveau secret (pas encore actif) et QR code à scanner. */
export async function startTwoFactorSetup(): Promise<TwoFactorResult> {
  const session = await currentUser();
  if (isRateLimited(`2fa-setup:${session.user.id}`, 10, 60 * 60_000)) return { error: TOO_MANY };
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { twoFactorEnabled: true } });
  if (user?.twoFactorEnabled) return { error: "La double authentification est déjà active." };
  const secret = generateTotpSecret();
  await prisma.user.update({
    where: { id: session.user.id },
    data: { twoFactorSecret: encryptSecret(secret), twoFactorLastStep: null },
  });
  const qr = await QRCode.toDataURL(otpauthUri(secret, session.user.email), { margin: 1, width: 220 });
  return { qr, secret: secret.replace(/(.{4})/g, "$1 ").trim() };
}

/** Étape 2 : le premier code valide active la protection et donne les codes de secours. */
export async function confirmTwoFactorSetup(formData: FormData): Promise<TwoFactorResult> {
  const session = await currentUser();
  if (isRateLimited(`2fa-confirm:${session.user.id}`, 10, 15 * 60_000)) return { error: TOO_MANY };
  const code = String(formData.get("code") ?? "");
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { twoFactorEnabled: true, twoFactorSecret: true },
  });
  if (!user || user.twoFactorEnabled) return { error: "La double authentification est déjà active." };
  const secret = decryptSecret(user.twoFactorSecret);
  if (!secret) return { error: "Recommencez l'activation." };
  const step = verifyTotp(secret, code, null);
  if (step == null) return { error: "Code incorrect. Vérifiez l'heure de votre téléphone et réessayez." };

  const { codes, hashes } = generateBackupCodes();
  await prisma.user.update({
    where: { id: session.user.id },
    data: { twoFactorEnabled: true, twoFactorLastStep: step, twoFactorBackupCodes: JSON.stringify(hashes) },
  });
  // Les autres appareils connectés devront saisir un code.
  const current = cookies().get(session.cookie)?.value ?? "";
  await prisma.session.deleteMany({ where: { userId: session.user.id, NOT: { token: current } } });
  notify(session.user.email, session.user.name, true);
  revalidatePath("/settings");
  return { ok: true, backupCodes: codes };
}

/** Désactivation : mot de passe ET code (ou code de secours) exigés. */
export async function disableTwoFactor(formData: FormData): Promise<TwoFactorResult> {
  const session = await currentUser();
  if (isRateLimited(`2fa-disable:${session.user.id}`, 5, 15 * 60_000)) return { error: TOO_MANY };
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { passwordHash: true } });
  if (!user || !(await verifyPassword(String(formData.get("password") ?? ""), user.passwordHash))) {
    return { error: "Mot de passe incorrect." };
  }
  const check = await checkSecondFactor(session.user.id, String(formData.get("code") ?? ""));
  if (check === "locked") return { error: "Trop de codes erronés : la vérification est bloquée temporairement. Réessayez plus tard." };
  if (!check) return { error: "Code incorrect ou déjà utilisé." };
  await prisma.user.update({
    where: { id: session.user.id },
    data: { twoFactorEnabled: false, twoFactorSecret: null, twoFactorBackupCodes: null, twoFactorLastStep: null, twoFactorFailedCount: 0, twoFactorLockedUntil: null },
  });
  notify(session.user.email, session.user.name, false);
  revalidatePath("/settings");
  return { ok: true };
}

/** Nouveaux codes de secours (les anciens ne marchent plus). */
export async function regenerateBackupCodes(formData: FormData): Promise<TwoFactorResult> {
  const session = await currentUser();
  if (isRateLimited(`2fa-backup:${session.user.id}`, 5, 15 * 60_000)) return { error: TOO_MANY };
  const check = await checkSecondFactor(session.user.id, String(formData.get("code") ?? ""));
  if (check === "locked") return { error: "Trop de codes erronés : la vérification est bloquée temporairement. Réessayez plus tard." };
  if (!check) return { error: "Code incorrect ou déjà utilisé." };
  const { codes, hashes } = generateBackupCodes();
  await prisma.user.update({ where: { id: session.user.id }, data: { twoFactorBackupCodes: JSON.stringify(hashes) } });
  revalidatePath("/settings");
  return { ok: true, backupCodes: codes };
}
