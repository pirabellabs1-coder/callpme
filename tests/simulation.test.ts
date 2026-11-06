import { describe, expect, it } from "vitest";
import { parseExpectations, ruleChecks, scriptLines, summarizeChecks } from "@/lib/simulation/checks";
import type { TranscriptTurn } from "@/lib/shared/types";

const transcript: TranscriptTurn[] = [
  { speaker: "agent", text: "Bonjour, cabinet du Dr Diallo.", at: 0 },
  { speaker: "caller", text: "Je voudrais un rendez-vous.", at: 1 },
  { speaker: "tool", text: "3 créneaux libres.", at: 2, toolName: "checkAvailability" },
  { speaker: "agent", text: "Je vous propose mardi à 10 h. Votre référence vous sera donnée.", at: 3 },
];

describe("vérifications de simulation", () => {
  it("contrôle les outils utilisés et les formulations", () => {
    const checks = ruleChecks(transcript, {
      mustCallTools: ["checkAvailability", "bookAppointment"],
      mustNotCallTools: ["transferToHuman"],
      mustSay: ["reference"],
      mustNotSay: ["je ne sais pas"],
    });
    expect(checks.map((c) => c.passed)).toEqual([true, false, true, true, true]);
    expect(summarizeChecks(checks)).toEqual({ passed: false, score: 80 });
  });

  it("réussit un scénario sans attente et lit les répliques", () => {
    expect(summarizeChecks([])).toEqual({ passed: true, score: 100 });
    expect(scriptLines("Appelant : Bonjour\n\n  Client: Oui merci  \n")).toEqual(["Bonjour", "Oui merci"]);
  });

  it("ignore des attentes mal formées", () => {
    expect(parseExpectations('{"mustSay": ["ok", 3, ""], "judge": "  "}')).toEqual({
      mustCallTools: [],
      mustNotCallTools: [],
      mustSay: ["ok"],
      mustNotSay: [],
      judge: undefined,
    });
    expect(parseExpectations("pas du json")).toEqual({});
  });
});
