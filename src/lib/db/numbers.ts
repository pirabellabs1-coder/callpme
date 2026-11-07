/**
 * Dépôt « Numéros » et « Connexions opérateur ».
 */
import { prisma } from "./client";
import { encryptSecret } from "../crypto/secrets";
import { toE164 } from "../telephony/e164";
import type {
  PhoneNumberRecord,
  ProviderConnectionRecord,
  TelephonyProvider,
} from "../shared/types";

export async function listPhoneNumbers(
  orgId: string,
): Promise<PhoneNumberRecord[]> {
  const [rows, assigned] = await Promise.all([
    prisma.phoneNumber.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "asc" },
    }),
    prisma.agent.findMany({
      where: { organizationId: orgId, phoneNumber: { not: null } },
      select: { id: true, name: true, phoneNumber: true },
    }),
  ]);
  const byNumber = new Map(assigned.map((a) => [toE164(a.phoneNumber!) ?? a.phoneNumber!, a]));
  const key = (n: string) => toE164(n) ?? n;

  return rows.map((r) => ({
    id: r.id,
    number: r.number,
    label: r.label,
    provider: r.provider as TelephonyProvider,
    monthlyPrice: r.monthlyPrice,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
    assignedAgentId: byNumber.get(key(r.number))?.id ?? null,
    assignedAgentName: byNumber.get(key(r.number))?.name ?? null,
  }));
}

export async function createPhoneNumber(
  orgId: string,
  data: {
    number: string;
    label: string;
    provider: TelephonyProvider;
    monthlyPrice?: number;
    /** « active » seulement pour un numéro acheté via la plateforme ou vérifié. */
    status?: "active" | "pending";
  },
): Promise<PhoneNumberRecord> {
  const row = await prisma.phoneNumber.create({
    data: {
      organizationId: orgId,
      number: toE164(data.number) ?? data.number,
      status: data.status ?? "pending",
      label: data.label,
      provider: data.provider,
      monthlyPrice: data.monthlyPrice ?? 0,
    },
  });
  return {
    id: row.id,
    number: row.number,
    label: row.label,
    provider: row.provider as TelephonyProvider,
    monthlyPrice: row.monthlyPrice,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    assignedAgentId: null,
    assignedAgentName: null,
  };
}

export async function deletePhoneNumber(orgId: string, id: string) {
  const row = await prisma.phoneNumber.findUnique({ where: { id } });
  if (!row || row.organizationId !== orgId) return false;
  // Numéro acheté via la plateforme : rendu à l'opérateur (fin de facturation).
  if (row.status === "provisioning" || row.status === "releasing") {
    throw new Error("Libération impossible : une opération est déjà en cours sur ce numéro.");
  }
  if (row.purchased && row.providerRef) {
    // Plus d'appels routés pendant la libération ; état restauré en cas d'échec.
    await prisma.phoneNumber.update({ where: { id }, data: { status: "releasing" } });
    const { releaseNumber } = await import("../telephony/numbers");
    const released = await releaseNumber(row.provider, row.providerRef, row.number);
    if (!released) {
      await prisma.phoneNumber.update({ where: { id }, data: { status: row.status } });
      throw new Error("Libération du numéro impossible chez l'opérateur.");
    }
  }
  // Agent relié : il perd ce numéro.
  await prisma.agent.updateMany({ where: { organizationId: orgId, phoneNumber: row.number }, data: { phoneNumber: null } });
  // Numéro venu de la marketplace : il retourne dans le stock (en pause), dans la même transaction.
  await prisma.$transaction([
    prisma.phoneNumber.delete({ where: { id } }),
    prisma.numberStock.updateMany({
      where: { number: row.number, organizationId: orgId, status: "assigned" },
      data: { status: "disabled", organizationId: null, requestId: null, note: `Rendu le ${new Date().toLocaleDateString("fr-FR")}` },
    }),
  ]);
  return true;
}

/* ------------------------------ Opérateurs ------------------------------- */

export async function listProviders(
  orgId: string,
): Promise<ProviderConnectionRecord[]> {
  const rows = await prisma.providerConnection.findMany({
    where: { organizationId: orgId },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((r) => ({
    id: r.id,
    provider: r.provider as TelephonyProvider,
    label: r.label,
    enabled: r.enabled,
    hasCredentials: Boolean(
      r.accountSid || r.authToken || r.apiKey || r.apiSecret,
    ),
    createdAt: r.createdAt.toISOString(),
    smsSender: r.smsSender ?? null,
  }));
}

export async function createProvider(
  orgId: string,
  data: {
    provider: TelephonyProvider;
    label: string;
    accountSid?: string;
    authToken?: string;
    apiKey?: string;
    apiSecret?: string;
    /** Empreinte de l'identifiant de compte (Twilio) pour authentifier ses webhooks. */
    accountKey?: string;
  },
): Promise<ProviderConnectionRecord> {
  const row = await prisma.providerConnection.create({
    data: {
      organizationId: orgId,
      provider: data.provider,
      label: data.label,
      accountKey: data.accountKey ?? null,
      accountSid: encryptSecret(data.accountSid),
      authToken: encryptSecret(data.authToken),
      apiKey: encryptSecret(data.apiKey),
      apiSecret: encryptSecret(data.apiSecret),
    },
  });
  return {
    id: row.id,
    provider: row.provider as TelephonyProvider,
    label: row.label,
    enabled: row.enabled,
    hasCredentials: Boolean(
      row.accountSid || row.authToken || row.apiKey || row.apiSecret,
    ),
    createdAt: row.createdAt.toISOString(),
    smsSender: row.smsSender ?? null,
  };
}

export async function deleteProvider(orgId: string, id: string) {
  const row = await prisma.providerConnection.findUnique({ where: { id } });
  if (!row || row.organizationId !== orgId) return false;
  // Ses numéros ne peuvent plus être appelés avec ce compte : ils repassent « en attente ».
  await prisma.$transaction([
    prisma.phoneNumber.updateMany({ where: { organizationId: orgId, connectionId: id }, data: { connectionId: null, status: "pending" } }),
    prisma.providerConnection.delete({ where: { id } }),
  ]);
  return true;
}
