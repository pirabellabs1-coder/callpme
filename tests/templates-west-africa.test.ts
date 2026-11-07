import { describe, expect, it } from "vitest";
import { AGENT_TEMPLATES, getTemplate, TEMPLATE_CATEGORIES } from "@/lib/agents/templates";
import { presetPersona, WEST_AFRICA_TEMPLATES } from "@/lib/agents/templates-west-africa";
import { generateSystemPrompt } from "@/lib/agents/role-templates";
import { createAgentSchema } from "@/lib/validation/agent";
import { buildPayload, initialState, promptParams } from "@/components/agents/wizard/state";
import { TOOL_REGISTRY } from "@/lib/tools/registry";

const KNOWN_TOOLS = new Set(Object.keys(TOOL_REGISTRY));

describe("modèles clé en main — Afrique de l'Ouest", () => {
  it("six métiers, visibles en tête de la galerie", () => {
    expect(WEST_AFRICA_TEMPLATES.map((t) => t.id)).toEqual([
      "wa-pharmacy",
      "wa-clinic",
      "wa-microfinance",
      "wa-school",
      "wa-transport",
      "wa-hospitality",
    ]);
    expect(TEMPLATE_CATEGORIES[0]).toBe("Afrique de l'Ouest");
    expect(AGENT_TEMPLATES.slice(0, 6)).toEqual(WEST_AFRICA_TEMPLATES);
    expect(new Set(AGENT_TEMPLATES.map((t) => t.id)).size).toBe(AGENT_TEMPLATES.length);
    for (const t of WEST_AFRICA_TEMPLATES) expect(getTemplate(t.id)).toBe(t);
  });

  it.each(WEST_AFRICA_TEMPLATES.map((t) => [t.id, t] as const))("%s : complet et valide contre le schéma Zod de l'agent", (_id, t) => {
    const p = t.preset!;
    expect(p.instructions.length).toBeGreaterThan(0);
    expect(p.guardrails.length).toBeGreaterThan(0);
    expect(p.fields.length).toBeGreaterThan(0);
    expect(p.tools).toContain("endCall");
    for (const tool of p.tools) expect(KNOWN_TOOLS.has(tool), tool).toBe(true);
    // Consignes jamais tronquées.
    expect(presetPersona(t).length).toBeLessThanOrEqual(1000);
    expect(presetPersona(t)).toContain(p.instructions.at(-1)!);

    // Ce que l'assistant de création enverrait à l'API, sans retouche.
    const st = { ...initialState(undefined, t), voiceId: "Adélaïde" };
    st.systemPrompt = generateSystemPrompt(promptParams(st, "Mon entreprise"));
    expect(st.guardrails).toEqual(p.guardrails);
    expect(st.tools).toEqual(p.tools);
    expect(st.analysisFields).toEqual(p.fields);
    const payload = buildPayload({ ...st, role: t.role }, { asDraft: false });
    const parsed = createAgentSchema.safeParse(payload);
    expect(parsed.success, JSON.stringify(parsed.error?.issues)).toBe(true);
    // Les consignes et garde-fous arrivent bien dans le prompt.
    expect(st.systemPrompt).toContain(p.instructions[0]);
    expect(st.systemPrompt).toContain(p.guardrails[0]);
  });

  it("rappel des bips activé par défaut, sans jamais refuser l'appel (pas de mode flash)", () => {
    for (const t of WEST_AFRICA_TEMPLATES) {
      const cb = initialState(undefined, t).callback;
      expect(cb.enabled).toBe(true);
      expect(cb.mode).toBe("missed");
    }
  });

  it("pas de consigne « lookupOrder » sans l'outil", () => {
    for (const id of ["wa-pharmacy", "wa-microfinance"]) {
      const st = initialState(undefined, getTemplate(id));
      expect(generateSystemPrompt(promptParams(st, "X"))).not.toContain("Utilise « lookupOrder »");
    }
    const transport = initialState(undefined, getTemplate("wa-transport"));
    expect(generateSystemPrompt(promptParams(transport, "X"))).toContain("Utilise « lookupOrder »");
  });

  it("microfinance : aucune donnée sensible", () => {
    const g = getTemplate("wa-microfinance")!.preset!.guardrails.join(" ").toLowerCase();
    expect(g).toContain("solde");
    expect(g).toContain("code pin");
    expect(g).toContain("numéro de compte");
    expect(getTemplate("wa-microfinance")!.preset!.tools).not.toContain("lookupOrder");
  });

  it("modèles de base inchangés : pas de preset, rappel désactivé", () => {
    const st = initialState(undefined, getTemplate("dentist"));
    expect(st.callback.enabled).toBe(false);
    expect(st.guardrails).toEqual([]);
    expect(st.analysisFields).toEqual([]);
  });
});
