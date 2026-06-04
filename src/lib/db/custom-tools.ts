/**
 * Dépôt « Fonctions personnalisées » (function calling sur-mesure).
 */
import { prisma } from "./client";
import type { CustomToolRecord, JSONSchema } from "../shared/types";

function parseParams(raw: string): JSONSchema {
  try {
    const p = JSON.parse(raw);
    if (p && typeof p === "object" && p.type === "object") {
      return p as JSONSchema;
    }
  } catch {
    /* ignore */
  }
  return { type: "object", properties: {} };
}

interface ToolRow {
  id: string;
  name: string;
  label: string;
  description: string;
  parameters: string;
  serverUrl: string | null;
  secret: string | null;
  method: string;
  createdAt: Date;
}

function toRecord(r: ToolRow): CustomToolRecord {
  return {
    id: r.id,
    name: r.name,
    label: r.label,
    description: r.description,
    parameters: parseParams(r.parameters),
    serverUrl: r.serverUrl,
    method: r.method,
    createdAt: r.createdAt.toISOString(),
  };
}

export interface CustomToolFull extends CustomToolRecord {
  secret: string | null;
  async: boolean;
  strict: boolean;
  lockSchema: boolean;
}

/** Pour le wizard : sans secret. */
export async function listCustomTools(
  orgId: string,
): Promise<CustomToolRecord[]> {
  const rows = await prisma.customTool.findMany({
    where: { organizationId: orgId },
    orderBy: { createdAt: "asc" },
  });
  return rows.map(toRecord);
}

/** Pour la gestion : avec secret. */
export async function listCustomToolsFull(
  orgId: string,
): Promise<CustomToolFull[]> {
  const rows = await prisma.customTool.findMany({
    where: { organizationId: orgId },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((r) => ({
    ...toRecord(r),
    secret: r.secret,
    async: r.async,
    strict: r.strict,
    lockSchema: r.lockSchema,
  }));
}

export async function getCustomToolByName(orgId: string, name: string) {
  return prisma.customTool.findFirst({
    where: { organizationId: orgId, name },
  });
}

export async function createCustomTool(
  orgId: string,
  data: {
    name: string;
    label: string;
    description: string;
    parameters: JSONSchema;
    serverUrl?: string | null;
    secret?: string | null;
    method?: string;
    async?: boolean;
    strict?: boolean;
    lockSchema?: boolean;
  },
): Promise<CustomToolFull> {
  const row = await prisma.customTool.create({
    data: {
      organizationId: orgId,
      name: data.name,
      label: data.label,
      description: data.description,
      parameters: JSON.stringify(data.parameters),
      serverUrl: data.serverUrl ?? null,
      secret: data.secret ?? null,
      method: data.method ?? "POST",
      async: data.async ?? false,
      strict: data.strict ?? false,
      lockSchema: data.lockSchema ?? false,
    },
  });
  return {
    ...toRecord(row),
    secret: row.secret,
    async: row.async,
    strict: row.strict,
    lockSchema: row.lockSchema,
  };
}

export async function deleteCustomTool(orgId: string, id: string) {
  const row = await prisma.customTool.findUnique({ where: { id } });
  if (!row || row.organizationId !== orgId) return false;
  await prisma.customTool.delete({ where: { id } });
  return true;
}
