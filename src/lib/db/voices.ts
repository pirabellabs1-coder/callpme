/** Dépôt « Voix » (Studio Voix — bibliothèque de voix produites en studio). */
import { prisma } from "./client";

export interface VoiceRecord {
  id: string;
  name: string;
  provider: string;
  status: string;
  gender: string | null;
  accent: string | null;
  description: string | null;
  sampleText: string | null;
  settings: string | null;
  sampleUrl: string | null;
  createdAt: string;
}

type Row = {
  id: string;
  name: string;
  provider: string;
  status: string;
  gender: string | null;
  accent: string | null;
  description: string | null;
  sampleText: string | null;
  settings: string | null;
  sampleUrl: string | null;
  createdAt: Date;
};

function toRecord(r: Row): VoiceRecord {
  return {
    id: r.id,
    name: r.name,
    provider: r.provider,
    status: r.status,
    gender: r.gender,
    accent: r.accent,
    description: r.description,
    sampleText: r.sampleText,
    settings: r.settings,
    sampleUrl: r.sampleUrl,
    createdAt: r.createdAt.toISOString(),
  };
}

export async function listVoices(orgId: string): Promise<VoiceRecord[]> {
  const rows = await prisma.voice.findMany({
    where: { organizationId: orgId },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toRecord);
}

export async function getVoice(orgId: string, id: string): Promise<VoiceRecord | null> {
  const r = await prisma.voice.findUnique({ where: { id } });
  if (!r || r.organizationId !== orgId) return null;
  return toRecord(r);
}

export async function createVoice(
  orgId: string,
  data: {
    name: string;
    provider?: string;
    gender?: string;
    accent?: string;
    description?: string;
    sampleText?: string;
    settings?: string;
    sampleUrl?: string;
  },
): Promise<VoiceRecord> {
  const r = await prisma.voice.create({
    data: {
      organizationId: orgId,
      name: data.name,
      provider: data.provider || "custom",
      status: "ready",
      gender: data.gender || null,
      accent: data.accent || null,
      description: data.description || null,
      sampleText: data.sampleText || null,
      settings: data.settings || null,
      sampleUrl: data.sampleUrl || null,
    },
  });
  return toRecord(r);
}

export async function updateVoice(
  orgId: string,
  id: string,
  data: {
    name?: string;
    gender?: string;
    accent?: string;
    description?: string;
    sampleText?: string;
    settings?: string;
    sampleUrl?: string;
  },
): Promise<VoiceRecord | null> {
  const existing = await prisma.voice.findUnique({ where: { id } });
  if (!existing || existing.organizationId !== orgId) return null;
  const r = await prisma.voice.update({
    where: { id },
    data: {
      name: data.name ?? undefined,
      gender: data.gender ?? undefined,
      accent: data.accent ?? undefined,
      description: data.description ?? undefined,
      sampleText: data.sampleText ?? undefined,
      settings: data.settings ?? undefined,
      sampleUrl: data.sampleUrl ?? undefined,
    },
  });
  return toRecord(r);
}

export async function deleteVoice(orgId: string, id: string) {
  const r = await prisma.voice.findUnique({ where: { id } });
  if (!r || r.organizationId !== orgId) return false;
  await prisma.voice.delete({ where: { id } });
  return true;
}
