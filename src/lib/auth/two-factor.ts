/**
 * Connexion en deux étapes. Après un mot de passe correct (ou Google), si la
 * double authentification est active, aucune session n'est créée : un cookie
 * de « défi » signé (5 minutes) mémorise l'utilisateur en attente du code.
 */
import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db/client";
import { decryptSecret } from "@/lib/crypto/secrets";
import { getAuthSecret } from "./secret";
import { consumeBackupCode, verifyTotp } from "./totp";
import { sendEmail } from "@/lib/email/resend";
import { emailLayout } from "@/lib/email/templates";

/** Après 5 échecs : 15 min de blocage, doublé à chaque nouvelle série (24 h au plus). */
const FAILS_PER_LOCK = 5;
const BASE_LOCK_MS = 15 * 60_000;
const MAX_LOCK_MS = 24 * 60 * 60_000;

export function lockDurationMs(failedCount: number): number {
  if (failedCount < FAILS_PER_LOCK || failedCount % FAILS_PER_LOCK !== 0) return 0;
  const series = failedCount / FAILS_PER_LOCK;
  return Math.min(BASE_LOCK_MS * 2 ** (series - 1), MAX_LOCK_MS);
}

async function registerFailure(userId: string) {
  const u = await prisma.user.update({
    where: { id: userId },
    data: { twoFactorFailedCount: { increment: 1 } },
    select: { twoFactorFailedCount: true, email: true },
  });
  const lockMs = lockDurationMs(u.twoFactorFailedCount);
  if (!lockMs) return;
  await prisma.user.update({ where: { id: userId }, data: { twoFactorLockedUntil: new Date(Date.now() + lockMs) } });
  // Alerte : quelqu'un connaît peut-être le mot de passe.
  const html = emailLayout({
    heading: "Tentatives de connexion bloquées",
    bodyHtml:
      `<p style="margin:0 0 12px;">Plusieurs codes de vérification erronés ont été saisis sur votre compte Callpme. ` +
      `Par sécurité, la saisie de code est bloquée pendant ${Math.round(lockMs / 60_000)} minutes.</p>` +
      `<p style="margin:0;">Si ce n'est pas vous, votre mot de passe est probablement connu : changez-le dès que possible.</p>`,
  });
  void sendEmail({ to: u.email, subject: "Sécurité — tentatives de connexion bloquées", html }).catch(() => {});
}

export const CHALLENGE_COOKIE = "cpme_2fa";
const CHALLENGE_TTL_MS = 5 * 60_000;

function sign(payload: string): string {
  return createHmac("sha256", getAuthSecret()).update(`2fa:${payload}`).digest("base64url");
}

export function makeChallenge(userId: string, now = Date.now()): string {
  const payload = `${userId}.${now + CHALLENGE_TTL_MS}`;
  return `${payload}.${sign(payload)}`;
}

export function readChallenge(value: string | undefined, now = Date.now()): string | null {
  if (!value) return null;
  const idx = value.lastIndexOf(".");
  if (idx < 0) return null;
  const payload = value.slice(0, idx);
  const sig = value.slice(idx + 1);
  const expected = sign(payload);
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  const [userId, exp] = payload.split(".");
  if (!userId || !exp || now > Number(exp)) return null;
  return userId;
}

export const challengeCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: CHALLENGE_TTL_MS / 1000,
};

/** Pose le défi (Server Action). */
export function setChallengeCookie(userId: string) {
  cookies().set(CHALLENGE_COOKIE, makeChallenge(userId), challengeCookieOptions);
}

/**
 * Vérifie un code (application ou code de secours) pour un utilisateur dont
 * la double authentification est active, et le consomme (un code ne sert
 * qu'une fois). Renvoie le moyen utilisé, ou null.
 */
export async function checkSecondFactor(userId: string, code: string): Promise<"totp" | "backup" | "locked" | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      twoFactorEnabled: true,
      twoFactorSecret: true,
      twoFactorLastStep: true,
      twoFactorBackupCodes: true,
      twoFactorLockedUntil: true,
    },
  });
  if (!user?.twoFactorEnabled) return null;
  if (user.twoFactorLockedUntil && user.twoFactorLockedUntil > new Date()) return "locked";
  const result = await matchSecondFactor(userId, user, code);
  if (result) {
    await prisma.user.update({ where: { id: userId }, data: { twoFactorFailedCount: 0, twoFactorLockedUntil: null } });
  } else {
    await registerFailure(userId);
  }
  return result;
}

async function matchSecondFactor(
  userId: string,
  user: { twoFactorSecret: string | null; twoFactorLastStep: number | null; twoFactorBackupCodes: string | null },
  code: string,
): Promise<"totp" | "backup" | null> {
  const secret = decryptSecret(user.twoFactorSecret);
  const digits = code.replace(/\s/g, "");
  if (secret && /^\d{6}$/.test(digits)) {
    const step = verifyTotp(secret, digits, user.twoFactorLastStep);
    if (step == null) return null;
    // Mise à jour conditionnelle : deux requêtes simultanées ne valident pas le même code.
    const r = await prisma.user.updateMany({
      where: { id: userId, OR: [{ twoFactorLastStep: null }, { twoFactorLastStep: { lt: step } }] },
      data: { twoFactorLastStep: step },
    });
    return r.count === 1 ? "totp" : null;
  }
  const remaining = consumeBackupCode(user.twoFactorBackupCodes, code);
  if (!remaining) return null;
  const r = await prisma.user.updateMany({
    where: { id: userId, twoFactorBackupCodes: user.twoFactorBackupCodes },
    data: { twoFactorBackupCodes: JSON.stringify(remaining) },
  });
  return r.count === 1 ? "backup" : null;
}
