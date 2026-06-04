/**
 * Dépôt « Numéros » et « Connexions opérateur ».
 */
import { prisma } from "./client";
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
  const byNumber = new Map(assigned.map((a) => [a.phoneNumber!, a]));

  return rows.map((r) => ({
    id: r.id,
    number: r.number,
    label: r.label,
    provider: r.provider as TelephonyProvider,
    monthlyPrice: r.monthlyPrice,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
    assignedAgentId: byNumber.get(r.number)?.id ?? null,
    assignedAgentName: byNumber.get(r.number)?.name ?? null,
  }));
}

export async function createPhoneNumber(
  orgId: string,
  data: {
    number: string;
    label: string;
    provider: TelephonyProvider;
    monthlyPrice?: number;
  },
): Promise<PhoneNumberRecord> {
  const row = await prisma.phoneNumber.create({
    data: {
      organizationId: orgId,
      number: data.number,
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
  await prisma.phoneNumber.delete({ where: { id } });
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
  },
): Promise<ProviderConnectionRecord> {
  const row = await prisma.providerConnection.create({
    data: {
      organizationId: orgId,
      provider: data.provider,
      label: data.label,
      accountSid: data.accountSid || null,
      authToken: data.authToken || null,
      apiKey: data.apiKey || null,
      apiSecret: data.apiSecret || null,
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
  };
}

export async function deleteProvider(orgId: string, id: string) {
  const row = await prisma.providerConnection.findUnique({ where: { id } });
  if (!row || row.organizationId !== orgId) return false;
  await prisma.providerConnection.delete({ where: { id } });
  return true;
}
