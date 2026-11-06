"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { CLIENT_COOKIE } from "@/lib/db/active-client";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { isOrgAdmin, requireSession } from "@/lib/auth/session";
import { checkDomainTxt, isPlatformDomain } from "@/lib/agency/domain";

/** Définit le client actif (ou « tous » si null) et rafraîchit l'UI. */
export async function setActiveClient(clientId: string | null) {
  if (clientId) {
    cookies().set(CLIENT_COOKIE, clientId, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  } else {
    cookies().delete(CLIENT_COOKIE);
  }
  revalidatePath("/", "layout");
}

export interface AgencyResult {
  ok?: boolean;
  error?: string;
}

const brandSchema = z.object({
  brandName: z.string().trim().max(60),
  brandLogoUrl: z
    .string()
    .trim()
    .max(500)
    .refine((v) => !v || /^https:\/\/[^\s"'<>]+$/.test(v), "Le logo doit être une adresse https."),
  customDomain: z
    .string()
    .trim()
    .toLowerCase()
    .max(253)
    .refine(
      (v) => !v || /^(?=.{4,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(v),
      "Domaine invalide (ex. espace.monagence.bj).",
    ),
});

/** Marque blanche de l'agence : nom, logo et domaine du portail client. */
export async function saveAgencyBrand(formData: FormData): Promise<AgencyResult> {
  const session = await requireSession();
  if (!isOrgAdmin(session)) return { error: "Réservé aux administrateurs." };
  if (session.org.plan !== "agency") return { error: "La marque blanche est réservée à l'offre Agence." };
  const parsed = brandSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Données invalides." };
  const d = parsed.data;
  const platformHost = process.env.PUBLIC_URL ? new URL(process.env.PUBLIC_URL).hostname : "";
  if (d.customDomain && isPlatformDomain(d.customDomain, [platformHost, "callpme.com"])) {
    return { error: "Choisissez un domaine qui vous appartient." };
  }
  const current = await prisma.organization.findUnique({ where: { id: session.org.id }, select: { customDomain: true } });
  try {
    await prisma.organization.update({
      where: { id: session.org.id },
      data: {
        brandName: d.brandName || null,
        brandLogoUrl: d.brandLogoUrl || null,
        customDomain: d.customDomain || null,
        // Nouveau domaine : à vérifier de nouveau.
        ...(d.customDomain !== (current?.customDomain ?? "") ? { customDomainVerifiedAt: null } : {}),
      },
    });
  } catch (e) {
    if ((e as { code?: string }).code === "P2002") return { error: "Ce domaine est déjà utilisé par un autre compte." };
    throw e;
  }
  revalidatePath("/clients");
  return { ok: true };
}

/** Retire un accès client (compte et sessions supprimés). */
export async function revokeClientAccess(userId: string): Promise<AgencyResult> {
  const session = await requireSession();
  if (!isOrgAdmin(session)) return { error: "Réservé aux administrateurs." };
  const id = String(userId);
  // Compte d'accès client (jamais un membre de l'agence), sinon invitation en attente.
  const users = await prisma.user.deleteMany({ where: { id, organizationId: session.org.id, clientId: { not: null } } });
  const invites = users.count
    ? { count: 0 }
    : await prisma.invitation.deleteMany({ where: { id, organizationId: session.org.id, clientId: { not: null }, acceptedAt: null } });
  revalidatePath("/clients");
  return users.count || invites.count ? { ok: true } : { error: "Accès introuvable." };
}

/** Vérifie l'enregistrement DNS TXT qui prouve la propriété du domaine. */
export async function verifyAgencyDomain(): Promise<AgencyResult> {
  const session = await requireSession();
  if (!isOrgAdmin(session)) return { error: "Réservé aux administrateurs." };
  const org = await prisma.organization.findUnique({ where: { id: session.org.id }, select: { customDomain: true } });
  if (!org?.customDomain) return { error: "Indiquez d'abord votre domaine." };
  if (!(await checkDomainTxt(session.org.id, org.customDomain))) {
    return { error: "Enregistrement TXT introuvable pour l'instant (la propagation DNS peut prendre jusqu'à quelques heures)." };
  }
  await prisma.organization.update({ where: { id: session.org.id }, data: { customDomainVerifiedAt: new Date() } });
  revalidatePath("/clients");
  return { ok: true };
}
