/**
 * Sessions authentifiées — stockées en base, référencées par un cookie
 * httpOnly. `getSession` est mémoïsé par requête (React cache) pour éviter
 * les lectures redondantes (layout + page + dépôts).
 */
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/db/client";
import { hasAdminUnlock } from "@/lib/auth/admin-gate";

export const SESSION_COOKIE = "cpme_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 jours

export interface SessionContext {
  user: {
    id: string;
    email: string;
    name: string | null;
    role: string;
    isAdmin: boolean;
  };
  org: {
    id: string;
    name: string;
    plan: string;
  };
}

/** Crée une session en base et renvoie son token (à poser en cookie). */
export async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + MAX_AGE_SECONDS * 1000);
  await prisma.session.create({ data: { token, userId, expiresAt } });
  return token;
}

/** Pose le cookie de session (à appeler dans une Server Action / Route Handler). */
export function setSessionCookie(token: string) {
  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

/** Lit la session courante depuis le cookie (mémoïsé par requête). */
export const getSession = cache(async (): Promise<SessionContext | null> => {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: { include: { organization: true } } },
  });
  if (!session || session.expiresAt < new Date()) return null;

  const u = session.user;
  return {
    user: { id: u.id, email: u.email, name: u.name, role: u.role, isAdmin: u.isAdmin },
    org: { id: u.organization.id, name: u.organization.name, plan: u.organization.plan },
  };
});

/** Garde-fou : renvoie la session ou redirige vers /login. */
export async function requireSession(): Promise<SessionContext> {
  const s = await getSession();
  if (!s) redirect("/login");
  return s;
}

/**
 * Garde-fou super-admin. Exige (1) une session, (2) un compte administrateur
 * plateforme ET (3) le déverrouillage via la porte secrète (cookie élevé).
 * Sans déverrouillage, on renvoie 404 : l'espace admin est invisible et /admin
 * n'est plus une porte d'entrée. La connexion admin se fait uniquement via
 * l'URL secrète (ADMIN_GATE_SLUG).
 */
export async function requireAdmin(): Promise<SessionContext> {
  const s = await getSession();
  if (!s) redirect("/login");
  if (!s.user.isAdmin) notFound();
  if (!hasAdminUnlock(s.user.id)) notFound();
  return s;
}

/** Détruit la session courante (Server Action / Route Handler). */
export async function destroySession() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { token } });
  }
  cookies().delete(SESSION_COOKIE);
}
