/**
 * Invitations d'équipe : lien à usage unique, valable 7 jours. Seule
 * l'empreinte SHA-256 du jeton est enregistrée : une fuite de la base ne
 * permet pas d'accepter une invitation.
 */
import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/db/client";

export const INVITE_TTL_MS = 7 * 24 * 60 * 60_000;
export const INVITE_ROLES = ["admin", "member"] as const;
export type InviteRole = (typeof INVITE_ROLES)[number];

export function hashInviteToken(token: string): string {
  return createHash("sha256").update(`callpme-invite:${token}`).digest("hex");
}

export function newInviteToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashInviteToken(token) };
}

/** Invitation encore valable (ni acceptée, ni expirée), avec le nom de l'organisation. */
export async function findPendingInvitation(token: string) {
  if (!/^[A-Za-z0-9_-]{30,80}$/.test(token)) return null;
  const inv = await prisma.invitation.findUnique({
    where: { tokenHash: hashInviteToken(token) },
    include: { organization: { select: { name: true } } },
  });
  if (!inv || inv.acceptedAt || inv.expiresAt < new Date()) return null;
  return inv;
}

export { canGrant, canManage } from "./roles";
