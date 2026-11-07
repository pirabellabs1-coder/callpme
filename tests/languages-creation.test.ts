import { afterEach, describe, expect, it, vi } from "vitest";
import {
  defaultGreeting,
  languageAvailability,
  languageFamily,
  languageInstructions,
  languageName,
  systemPhrases,
} from "@/lib/voice-engine/languages";
import { callbackGreeting, DEFAULT_CALLBACK } from "@/lib/callbacks/settings";
import { sttProviderFor } from "@/lib/voice-engine/stt";
import { ttsProviderFor } from "@/lib/voice-engine/tts";
import { languageOptionLabel, LANGUAGES } from "@/lib/agents/catalog";
import { buildDefaultConfig } from "@/lib/agents/build-config";
import { ROLE_META } from "@/lib/agents/roles";
import { buildPayload, followGreeting, greetingFor, initialState } from "@/components/agents/wizard/state";

afterEach(() => vi.unstubAllEnvs());

const names = { agentName: "Awa", organizationName: "Pharmacie du Port" };

describe("langues proposées à la création d'un agent", () => {
  it("français, anglais et langues locales figurent dans la liste, chacun dans son groupe", () => {
    const families = new Set(LANGUAGES.map((l) => l.family));
    expect(families).toEqual(new Set(["fr", "en", "local"]));
    expect(LANGUAGES.find((l) => l.id === "en-US")?.availability).toBe("disponible");
    expect(languageFamily("en-GB")).toBe("en");
    expect(languageFamily("yo-NG")).toBe("local");
  });

  it("distingue « bientôt » (aucun fournisseur) de « en activation » (clés à poser)", () => {
    expect(languageAvailability("fon-BJ", new Set())).toBe("bientôt");
    expect(languageAvailability("yo-NG", new Set())).toBe("activation");
    expect(languageAvailability("yo-NG", new Set(["yo-NG"]))).toBe("disponible");
    expect(languageAvailability("en-US", new Set())).toBe("disponible");
    const yo = { ...LANGUAGES.find((l) => l.id === "yo-NG")!, availability: "activation" as const };
    expect(languageOptionLabel(yo)).toContain("clé fournisseur manquante");
    const fon = LANGUAGES.find((l) => l.id === "fon-BJ")!;
    expect(languageOptionLabel(fon)).toMatch(/— bientôt$/);
    expect(languageFamily("es-ES")).toBe("other");
    expect(languageFamily("fr-CA")).toBe("fr");
  });

  it("l'anglais passe par les fournisseurs du français", () => {
    vi.stubEnv("DEEPGRAM_API_KEY", "test");
    vi.stubEnv("ELEVENLABS_API_KEY", "test");
    vi.stubEnv("VOICE_TTS_PROVIDER", "");
    expect(sttProviderFor("en-US")).toBe("deepgram");
    expect(ttsProviderFor("en-US")).toBe("elevenlabs");
  });
});

describe("consignes et accueil dans la langue choisie", () => {
  it("anglais : consigne de répondre en anglais ; français : rien d'ajouté", () => {
    expect(languageInstructions("en-US")).toContain("Réponds toujours en anglais");
    expect(languageInstructions("fr-FR")).toBe("");
    expect(languageName("ha-NG")).toBe("haoussa");
    expect(languageInstructions("en-US", true)).not.toContain("mélanger");
  });

  it("accueil en anglais, yoruba, haoussa avec le nom de l'agent et de l'entreprise", () => {
    expect(defaultGreeting("en-US", names)).toBe("Hello! This is Awa from Pharmacie du Port. How can I help you today?");
    expect(defaultGreeting("yo-NG", names)).toContain("Èmi ni Awa láti Pharmacie du Port");
    expect(defaultGreeting("ha-NG", names)).toContain("Ni ne Awa daga Pharmacie du Port");
    expect(defaultGreeting("en-US", {})).toBe("Hello! How can I help you today?");
  });

  it("bilingue ou wolof : salutation locale puis français", () => {
    expect(defaultGreeting("wo-SN", names)).toBe("Asalaa maalekum ! Bonjour, ici Awa de Pharmacie du Port. Comment puis-je vous aider ?");
    expect(defaultGreeting("yo-NG", names, true)).toMatch(/^Ẹ n lẹ́ o ! Bonjour, ici Awa/);
    expect(greetingFor("support", "yo-NG", names, { bilingual: true })).toMatch(/^Ẹ n lẹ́ o ! Bonjour/);
  });

  it("français : l'accueil du rôle (ou du modèle) est conservé", () => {
    expect(defaultGreeting("fr-FR", names)).toBeNull();
    expect(greetingFor("support", "fr-FR", names)).toBe(ROLE_META.support.firstMessage);
    expect(greetingFor("support", "fr-BE", names, { frenchDefault: "Bonjour du modèle" })).toBe("Bonjour du modèle");
    expect(greetingFor("support", "en-US", names)).toMatch(/^Hello!/);
  });

  it("agent créé par l'API dans une autre langue : accueil dans cette langue, langue enregistrée", () => {
    const cfg = buildDefaultConfig("support", "Awa", "Pharmacie du Port", { voice: { language: "en-GB" } });
    expect(cfg.voice.language).toBe("en-GB");
    expect(cfg.firstMessage).toMatch(/^Hello!/);
    const fr = buildDefaultConfig("support", "Awa", "Pharmacie du Port");
    expect(fr.voice.language).toBe("fr-FR");
    expect(fr.firstMessage).toBe(ROLE_META.support.firstMessage);
    const own = buildDefaultConfig("support", "Awa", "X", { voice: { language: "en-US" }, firstMessage: "Hi there" });
    expect(own.firstMessage).toBe("Hi there");
  });
});

describe("l'accueil suit la langue dans l'assistant", () => {
  const ctx = { organizationName: "Pharmacie du Port" };
  const base = () => ({ ...initialState(), name: "Awa", role: "support" as const, firstMessage: ROLE_META.support.firstMessage });

  it("accueil non modifié : il passe dans la nouvelle langue", () => {
    const next = followGreeting(base(), { language: "en-US" }, false, ctx);
    expect(next.language).toBe("en-US");
    expect(next.firstMessage).toBe("Hello! This is Awa from Pharmacie du Port. How can I help you today?");
  });

  it("accueil réécrit à la main, ou rôle pas encore choisi : il ne bouge pas", () => {
    const own = { ...base(), firstMessage: "Mon accueil" };
    expect(followGreeting(own, { language: "en-US" }, true, ctx).firstMessage).toBe("Mon accueil");
    const noRole = { ...base(), role: null };
    expect(followGreeting(noRole, { language: "en-US" }, false, ctx).firstMessage).toBe(ROLE_META.support.firstMessage);
  });

  it("retour au français depuis un modèle : l'accueil du modèle revient", () => {
    const template = { role: "support" as const, firstMessage: "Bienvenue à la pharmacie !" };
    const en = followGreeting(base(), { language: "en-US" }, false, { ...ctx, template });
    expect(followGreeting(en, { language: "fr-FR" }, false, { ...ctx, template }).firstMessage).toBe("Bienvenue à la pharmacie !");
  });

  it("champ vidé : l'agent enregistré reçoit l'accueil proposé à l'écran", () => {
    const st = { ...base(), language: "en-US", firstMessage: "" };
    const payload = buildPayload(st, { asDraft: true, greeting: ctx });
    expect(payload.config.firstMessage).toBe("Hello! This is Awa from Pharmacie du Port. How can I help you today?");
  });
});

describe("phrases du moteur dans la langue de l'agent", () => {
  it("anglais : repli, erreur, transfert, répondeur et rappel en anglais", () => {
    const en = systemPhrases("en-GB");
    expect(en.transfer).toMatch(/please hold/);
    expect(en.fallbackGreeting).toBe("Hello, how can I help you?");
    expect(callbackGreeting(DEFAULT_CALLBACK, "Awa", "", "en-US")).toBe(
      "Hello, this is Awa from our team. You tried to reach us a few moments ago, so I'm calling you back. How can I help you?",
    );
  });

  it("français et langues locales : phrases en français, comme avant", () => {
    expect(systemPhrases("fr-FR").transfer).toBe("Je vous mets en relation avec un conseiller, ne quittez pas.");
    expect(systemPhrases("wo-SN").fallbackGreeting).toBe("Bonjour, comment puis-je vous aider ?");
    expect(callbackGreeting(DEFAULT_CALLBACK, "Awa", "Pharmacie")).toMatch(/^Bonjour, ici Awa de Pharmacie/);
  });
});
