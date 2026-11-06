"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/client";
import { requireSession } from "@/lib/auth/session";
import { getAgentById, updateAgent } from "@/lib/db/agents";
import { applyBehavior } from "@/lib/agents/versions";
import type { AgentConfig } from "@/lib/shared/types";

export interface VersionResult {
  ok?: boolean;
  error?: string;
}

async function ownedAgentAndVersion(agentId: string, versionId: string) {
  const session = await requireSession();
  const agent = await getAgentById(String(agentId));
  if (!agent || agent.organizationId !== session.org.id) return null;
  const version = await prisma.agentVersion.findFirst({ where: { id: String(versionId), agentId: agent.id } });
  if (!version) return null;
  let config: AgentConfig;
  try {
    config = JSON.parse(version.config) as AgentConfig;
  } catch {
    return null;
  }
  return { agent, version, config };
}

/** Restaure le comportement d'une version (canaux et test A/B conservés). */
export async function restoreVersion(agentId: string, versionId: string): Promise<VersionResult> {
  const found = await ownedAgentAndVersion(agentId, versionId);
  if (!found) return { error: "Version introuvable." };
  await updateAgent(found.agent.id, { config: applyBehavior(found.agent.config, found.config) });
  revalidatePath(`/agents/${found.agent.id}`, "layout");
  return { ok: true };
}

/** Lance un test A/B : `share` % des appels utilisent la version choisie. */
export async function startAbTest(agentId: string, versionId: string, share: number): Promise<VersionResult> {
  const found = await ownedAgentAndVersion(agentId, versionId);
  if (!found) return { error: "Version introuvable." };
  const s = Math.round(Number(share));
  if (!(s >= 5 && s <= 50)) return { error: "Part des appels : entre 5 et 50 %." };
  await updateAgent(found.agent.id, {
    config: { abTest: { enabled: true, versionId: found.version.id, share: s, startedAt: new Date().toISOString() } },
  });
  revalidatePath(`/agents/${found.agent.id}`, "layout");
  return { ok: true };
}

/** Arrête le test ; `adopt` : la variante B devient la version utilisée pour tous les appels. */
export async function stopAbTest(agentId: string, adopt: boolean): Promise<VersionResult> {
  const session = await requireSession();
  const agent = await getAgentById(String(agentId));
  if (!agent || agent.organizationId !== session.org.id) return { error: "Agent introuvable." };
  const ab = agent.config.abTest;
  if (!ab?.enabled) return { error: "Aucun test en cours." };
  let config: AgentConfig = { ...agent.config, abTest: { ...ab, enabled: false } };
  if (adopt) {
    const version = await prisma.agentVersion.findFirst({ where: { id: ab.versionId, agentId: agent.id } });
    if (!version) return { error: "Version testée introuvable." };
    config = applyBehavior(config, JSON.parse(version.config) as AgentConfig);
  }
  await updateAgent(agent.id, { config });
  revalidatePath(`/agents/${agent.id}`, "layout");
  return { ok: true };
}
