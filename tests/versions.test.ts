import { describe, expect, it } from "vitest";
import { applyBehavior, behaviorChanges, pickVariant } from "@/lib/agents/versions";
import type { AgentConfig } from "@/lib/shared/types";

const base = {
  systemPrompt: "Consignes v1",
  firstMessage: "Bonjour",
  voice: { provider: "elevenlabs", voiceId: "a", language: "fr-FR", speed: 1 },
  widget: { enabled: true, allowedDomains: ["site.bj"] },
} as unknown as AgentConfig;

describe("versions d'agent", () => {
  it("détecte les changements de comportement, pas ceux des canaux", () => {
    expect(behaviorChanges(base, { ...base, systemPrompt: "Consignes v2" })).toEqual(["consignes"]);
    expect(behaviorChanges(base, { ...base, widget: { enabled: false, allowedDomains: [] } })).toEqual([]);
  });

  it("restaurer une version garde les réglages du site et du test A/B", () => {
    const current = { ...base, systemPrompt: "v3", widget: { enabled: true, allowedDomains: ["nouveau.bj"] } } as AgentConfig;
    const restored = applyBehavior(current, base);
    expect(restored.systemPrompt).toBe("Consignes v1");
    expect(restored.widget?.allowedDomains).toEqual(["nouveau.bj"]);
  });

  it("répartit les appels selon la part choisie, plafonnée à 50 %", () => {
    expect(pickVariant(20, 0.1)).toBe("B");
    expect(pickVariant(20, 0.3)).toBe("A");
    expect(pickVariant(90, 0.6)).toBe("A");
    expect(pickVariant(0, 0)).toBe("A");
  });
});
