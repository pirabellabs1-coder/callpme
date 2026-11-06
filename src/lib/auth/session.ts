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
import { PORTAL_COOKIE_NAME } from "./cookie-names";

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
  // Un accès client (portail d'agence) n'ouvre jamais le tableau de bord de l'agence.
  if (u.clientId) return null;
  return {
    user: { id: u.id, email: u.email, name: u.name, role: u.role, isAdmin: u.isAdmin },
    org: { id: u.organization.id, name: u.organization.name, plan: u.organization.plan },
  };
});

/* ------------------------- Portail des clients d'agence ------------------------- */

/** Cookie distinct : les routes du tableau de bord ne le lisent jamais. */
export const CLIENT_COOKIE = PORTAL_COOKIE_NAME;

export interface ClientSessionContext {
  user: { id: string; email: string; name: string | null };
  client: { id: string; name: string; brandColor: string | null; logoUrl: string | null };
  org: { id: string; name: string; brandName: string | null; brandLogoUrl: string | null };
}

export function setClientCookie(token: string) {
  cookies().set(CLIENT_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

/** Session d'un accès client (portail /espace). */
export const getClientSession = cache(async (): Promise<ClientSessionContext | null> => {
  const token = cookies().get(CLIENT_COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: { include: { organization: true, client: true } } },
  });
  if (!session || session.expiresAt < new Date()) return null;
  const u = session.user;
  if (!u.clientId || !u.client || u.client.organizationId !== u.organizationId) return null;
  // Accès clients réservés à l'offre Agence (coupés si l'agence change d'offre).
  if (u.organization.plan !== "agency") return null;
  return {
    user: { id: u.id, email: u.email, name: u.name },
    client: { id: u.client.id, name: u.client.name, brandColor: u.client.brandColor, logoUrl: u.client.logoUrl },
    org: { id: u.organization.id, name: u.organization.name, brandName: u.organization.brandName, brandLogoUrl: u.organization.brandLogoUrl },
  };
});

export async function requireClientSession(): Promise<ClientSessionContext> {
  const s = await getClientSession();
  if (!s) redirect("/login");
  return s;
}

/** Ferme la session du portail client. */
export async function destroyClientSession() {
  const token = cookies().get(CLIENT_COOKIE)?.value;
  if (token) await prisma.session.deleteMany({ where: { token } });
  cookies().delete(CLIENT_COOKIE);
}

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

/** Propriétaire ou administrateur de l'organisation (actions sensibles). */
export function isOrgAdmin(session: SessionContext): boolean {
  return session.user.role === "owner" || session.user.role === "admin";
}
