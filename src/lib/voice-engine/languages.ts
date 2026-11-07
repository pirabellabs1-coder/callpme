/**
 * Langues du moteur vocal : qui transcrit (STT) et qui parle (TTS) pour
 * chaque langue, et ce qui est réellement possible aujourd'hui.
 *
 * Module pur, partagé par l'interface (catalogue, assistant) et le serveur
 * vocal. Recherche et sources : docs/langues-locales.md (relevé du 6 nov. 2026).
 *
 * Deux verrous avant qu'une langue locale soit proposée à un client :
 * 1. `status: "disponible"` — un fournisseur commercial couvre la langue de
 *    bout en bout (transcription + voix) et il est branché dans le moteur ;
 * 2. la langue figure dans NEXT_PUBLIC_VOICE_LOCAL_LANGUAGES — le fondateur
 *    l'active après avoir mis les clés sur le serveur vocal et testé un appel.
 * Sans ces deux conditions, la langue s'affiche « bientôt » et ne peut pas être choisie.
 */

export type SttProviderId = "deepgram" | "google" | "elevenlabs" | "spitch";
export type TtsProviderId = "elevenlabs" | "cartesia" | "spitch";

/** « disponible » : branché et couvert de bout en bout ; « bientôt » : manque un fournisseur ou des données. */
export type LanguageStatus = "disponible" | "bientôt";

/** Niveau de Claude dans la langue (voir la doc) : conditionne le mode bilingue. */
export type LlmLevel = "natif" | "correct" | "faible" | "insuffisant";

export interface VoiceLanguage {
  /** Identifiant stocké dans l'agent (config.voice.language). */
  id: string;
  label: string;
  /** Langue locale d'Afrique de l'Ouest (sinon : français ou anglais). */
  local: boolean;
  status: LanguageStatus;
  llm: LlmLevel;
  /** Fournisseurs de transcription, par ordre de préférence. */
  stt: SttProviderId[];
  /** Fournisseurs de voix, par ordre de préférence. */
  tts: TtsProviderId[];
  /** Code de langue attendu par chaque fournisseur de transcription. */
  sttCodes: Partial<Record<SttProviderId, string>>;
  /** Code de langue attendu par chaque fournisseur de voix. */
  ttsCodes: Partial<Record<TtsProviderId, string>>;
  /** Pourquoi la langue n'est pas encore disponible / ce qu'il faut savoir. */
  note?: string;
}

const FR_STT: SttProviderId[] = ["deepgram"];
const FR_TTS: TtsProviderId[] = ["elevenlabs", "cartesia"];

export const VOICE_LANGUAGES: VoiceLanguage[] = [
  { id: "fr-FR", label: "Français (France)", local: false, status: "disponible", llm: "natif", stt: FR_STT, tts: FR_TTS, sttCodes: {}, ttsCodes: {} },
  { id: "fr-BE", label: "Français (Belgique)", local: false, status: "disponible", llm: "natif", stt: FR_STT, tts: FR_TTS, sttCodes: {}, ttsCodes: {} },
  { id: "fr-CA", label: "Français (Canada)", local: false, status: "disponible", llm: "natif", stt: FR_STT, tts: FR_TTS, sttCodes: {}, ttsCodes: {} },

  // Anglais : mêmes fournisseurs que le français (Deepgram, ElevenLabs Flash, Cartesia le parlent).
  { id: "en-US", label: "Anglais (États-Unis)", local: false, status: "disponible", llm: "natif", stt: FR_STT, tts: FR_TTS, sttCodes: {}, ttsCodes: {} },
  { id: "en-GB", label: "Anglais (Royaume-Uni)", local: false, status: "disponible", llm: "natif", stt: FR_STT, tts: FR_TTS, sttCodes: {}, ttsCodes: {} },

  // Langues locales couvertes par des fournisseurs commerciaux.
  {
    id: "yo-NG",
    label: "Yoruba",
    local: true,
    status: "disponible",
    llm: "correct",
    stt: ["elevenlabs", "google", "spitch"],
    tts: ["spitch", "elevenlabs"],
    sttCodes: { google: "yo-NG", elevenlabs: "yor", spitch: "yo" },
    ttsCodes: { elevenlabs: "yo", spitch: "yo" },
    note: "Claude Haiku 5.5 atteint 87 % de son niveau anglais en yoruba ; Sonnet comprend mieux mais coûte plus cher (voir la marge).",
  },
  {
    id: "ha-NG",
    label: "Haoussa",
    local: true,
    status: "disponible",
    llm: "correct",
    stt: ["elevenlabs", "google", "spitch"],
    tts: ["elevenlabs", "spitch"],
    sttCodes: { google: "ha-NG", elevenlabs: "hau", spitch: "ha" },
    ttsCodes: { elevenlabs: "ha", spitch: "ha" },
  },
  {
    id: "wo-SN",
    label: "Wolof",
    local: true,
    status: "disponible",
    llm: "faible",
    stt: ["elevenlabs", "google"],
    tts: ["elevenlabs"],
    sttCodes: { google: "wo-SN", elevenlabs: "wol" },
    ttsCodes: { elevenlabs: "wo" },
    note: "Claude comprend mal le wolof seul : l'agent fonctionne en mode bilingue (wolof urbain + français).",
  },

  // Pas encore possibles : aucun fournisseur commercial, ou une seule brique.
  {
    id: "fon-BJ",
    label: "Fon (fongbè)",
    local: true,
    status: "bientôt",
    llm: "insuffisant",
    stt: [],
    tts: [],
    sttCodes: {}, ttsCodes: {},
    note: "Aucune API commerciale de transcription ni de voix ; à entraîner sur des appels enregistrés.",
  },
  { id: "ee-TG", label: "Éwé / Mina", local: true, status: "bientôt", llm: "faible", stt: [], tts: [], sttCodes: {}, ttsCodes: {}, note: "Pas de transcription commerciale ; voix éwé possible (Khaya), mina absent." },
  { id: "tw-GH", label: "Twi (akan)", local: true, status: "bientôt", llm: "faible", stt: [], tts: [], sttCodes: {}, ttsCodes: {}, note: "Transcription en direct seulement chez Intron (prix sur devis), voix chez Khaya sans streaming." },
  { id: "ddn-BJ", label: "Dendi", local: true, status: "bientôt", llm: "insuffisant", stt: [], tts: [], sttCodes: {}, ttsCodes: {}, note: "Aucun fournisseur ; données à collecter." },
  { id: "bba-BJ", label: "Bariba (baatonum)", local: true, status: "bientôt", llm: "insuffisant", stt: [], tts: [], sttCodes: {}, ttsCodes: {}, note: "Aucun fournisseur ; données à collecter." },
  { id: "bm-ML", label: "Bambara / Dioula", local: true, status: "bientôt", llm: "faible", stt: [], tts: [], sttCodes: {}, ttsCodes: {}, note: "Aucun fournisseur commercial ; à entraîner sur des enregistrements." },
];

export function voiceLanguage(id: string | undefined | null): VoiceLanguage | undefined {
  if (!id) return undefined;
  return VOICE_LANGUAGES.find((l) => l.id === id);
}

/** Langues locales activées par le fondateur (NEXT_PUBLIC_VOICE_LOCAL_LANGUAGES, séparées par des virgules). */
export function activatedLocalLanguages(raw = process.env.NEXT_PUBLIC_VOICE_LOCAL_LANGUAGES): Set<string> {
  return new Set(
    (raw ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

/** Une langue peut-elle être choisie pour un agent ? */
export function isSelectableLanguage(id: string, activated = activatedLocalLanguages()): boolean {
  const l = voiceLanguage(id);
  if (!l) return false;
  if (l.status !== "disponible") return false;
  return !l.local || activated.has(l.id);
}

/**
 * État d'une langue dans l'assistant :
 * - « disponible » : peut être choisie ;
 * - « activation » : branchée, mais le fondateur ne l'a pas encore activée
 *   (clés fournisseur à poser, puis NEXT_PUBLIC_VOICE_LOCAL_LANGUAGES) ;
 * - « bientôt » : aucun fournisseur ne la couvre encore.
 */
export type LanguageAvailability = "disponible" | "activation" | "bientôt";

export function languageAvailability(id: string, activated = activatedLocalLanguages()): LanguageAvailability {
  const l = voiceLanguage(id);
  if (!l || l.status !== "disponible") return "bientôt";
  return isSelectableLanguage(id, activated) ? "disponible" : "activation";
}

/** Famille de la langue, pour regrouper la liste : français, anglais ou langue locale. */
export function languageFamily(id: string): "fr" | "en" | "local" | "other" {
  const l = voiceLanguage(id);
  if (l?.local) return "local";
  if (id.startsWith("en")) return "en";
  // Identifiant hors registre (ex. « es-ES » créé par l'API) : ni français ni anglais.
  return !id || id.startsWith("fr") ? "fr" : "other";
}

/** Nom courant de la langue, en minuscules (« anglais », « yoruba »…). */
export function languageName(id: string): string {
  const l = voiceLanguage(id);
  return l ? l.label.split(" ")[0].toLowerCase() : id;
}

/**
 * Une langue est-elle refusée à l'enregistrement d'un agent ? Seules les
 * langues du registre non sélectionnables le sont : un identifiant inconnu
 * (ex. « es-ES » via l'API) reste accepté comme avant.
 */
export function isRejectedLanguage(id: string, activated = activatedLocalLanguages()): boolean {
  return Boolean(voiceLanguage(id)) && !isSelectableLanguage(id, activated);
}

/**
 * Mode bilingue (français + langue locale) : conseillé pour toute langue
 * locale, imposé quand Claude est faible dans la langue seule.
 */
export function bilingualRequired(id: string): boolean {
  const l = voiceLanguage(id);
  return Boolean(l?.local && (l.llm === "faible" || l.llm === "insuffisant"));
}

const short = (language: string) => (language || "fr").slice(0, 2);

/** Code de langue à envoyer au fournisseur de transcription (par défaut : les 2 premières lettres). */
export function sttLanguageCode(language: string, provider: SttProviderId): string {
  return voiceLanguage(language)?.sttCodes[provider] ?? short(language);
}

/** Code de langue à envoyer au fournisseur de voix (par défaut : les 2 premières lettres). */
export function providerLanguageCode(language: string, provider: TtsProviderId): string {
  return voiceLanguage(language)?.ttsCodes[provider] ?? short(language);
}

/** Fournisseurs de transcription candidats pour une langue (langue inconnue : comme le français). */
export function sttCandidates(language: string): SttProviderId[] {
  return voiceLanguage(language)?.stt ?? FR_STT;
}

/** Fournisseurs de voix candidats pour une langue (langue inconnue : comme le français). */
export function ttsCandidates(language: string): TtsProviderId[] {
  return voiceLanguage(language)?.tts ?? FR_TTS;
}

/** Consignes d'orthographe par langue : la voix a besoin des tons et signes pour bien prononcer. */
const SCRIPT_HINT: Record<string, string> = {
  "yo-NG": "Écris le yoruba avec tous ses signes et tons (ẹ, ọ, ṣ, à, á…) : la voix en a besoin pour bien prononcer.",
  "ha-NG": "Écris le haoussa en alphabet latin standard (boko), avec ɓ, ɗ et ƙ quand ils s'appliquent.",
  "wo-SN": "Écris le wolof selon l'orthographe officielle du Sénégal (ë, ñ, ŋ, à…).",
};

/**
 * Bloc « Langue » ajouté au prompt système quand l'agent parle une langue
 * locale. Vide pour le français (comportement inchangé).
 *
 * - Monolingue (Claude correct dans la langue) : répondre dans la langue.
 * - Bilingue : l'appelant mélange le français et la langue locale (code-switching
 *   documenté à Cotonou, Lagos, Dakar) ; l'agent suit la langue de l'appelant.
 *   Quand Claude est faible dans la langue, il répond en français et ne garde
 *   de la langue locale que des formules sûres (salutations, politesse).
 */
export function languageInstructions(language: string, bilingual = false): string {
  const l = voiceLanguage(language);
  if (!l) return "";
  // Anglais : instructions rédigées en français, réponses en anglais.
  if (!l.local) {
    if (languageFamily(l.id) !== "en") return "";
    return [
      "## Langue",
      "L'appelant parle anglais. Réponds toujours en anglais, même si tes instructions sont rédigées en français.",
      "Dis les nombres, prix et heures de façon simple ; répète les numéros de téléphone chiffre par chiffre pour les confirmer.",
    ].join("\n");
  }
  const name = languageName(l.id);
  const lines: string[] = ["## Langue"];
  const weak = l.llm === "faible" || l.llm === "insuffisant";
  if (bilingual || weak) {
    lines.push(`L'appelant peut parler français, ${name}, ou mélanger les deux dans la même phrase.`);
    if (weak) {
      lines.push(
        `Réponds en français simple et clair. Utilise le ${name} seulement pour des formules courantes dont tu es certain (salutations, remerciements, politesse) ; n'invente jamais une phrase en ${name}.`,
      );
    } else {
      lines.push(
        `Réponds dans la langue de la dernière phrase de l'appelant : en ${name} s'il parle ${name}, en français s'il parle français. S'il mélange, réponds en français simple et garde les formules de politesse en ${name}.`,
      );
    }
  } else {
    lines.push(`L'appelant parle ${name}. Réponds toujours en ${name}, même si tes instructions sont rédigées en français.`);
  }
  if (SCRIPT_HINT[l.id] && !weak) lines.push(SCRIPT_HINT[l.id]);
  lines.push(
    "La transcription de l'appelant peut être approximative (tons ou accents manquants, mots mal reconnus) : comprends le sens, et fais répéter poliment si un élément important (nom, numéro, date) est ambigu.",
    "Dis les nombres, prix et heures de façon simple ; répète les numéros de téléphone chiffre par chiffre pour les confirmer.",
  );
  return lines.join("\n");
}

/**
 * Mode bilingue réellement appliqué pendant l'appel : choix de l'agent, ou
 * imposé par la langue (agent créé par l'API sans le champ, par exemple).
 */
export function effectiveBilingual(language: string | undefined | null, bilingual?: boolean): boolean {
  const l = voiceLanguage(language);
  if (!l?.local) return false;
  return Boolean(bilingual) || bilingualRequired(l.id);
}

/**
 * Message d'accueil proposé quand l'agent ne parle pas français. Le français
 * garde l'accueil propre à chaque rôle (ROLE_META). Les accueils en langue
 * locale sont volontairement courts et à faire relire par un locuteur natif.
 * Mode bilingue : une salutation dans la langue, puis la suite en français.
 */
export function defaultGreeting(
  language: string,
  names: { agentName?: string; organizationName?: string },
  bilingual = false,
): string | null {
  const l = voiceLanguage(language);
  if (!l || languageFamily(l.id) === "fr") return null;
  const agent = names.agentName?.trim();
  const org = names.organizationName?.trim();
  if (languageFamily(l.id) === "en") {
    const who = agent ? `This is ${agent}${org ? ` from ${org}` : ""}. ` : org ? `Thank you for calling ${org}. ` : "";
    return `Hello! ${who}How can I help you today?`;
  }
  const fr = `Bonjour${agent ? `, ici ${agent}` : ""}${org ? ` de ${org}` : ""}. Comment puis-je vous aider ?`;
  const local: Record<string, { hello: string; full: string }> = {
    "yo-NG": {
      hello: "Ẹ n lẹ́ o !",
      full: `Ẹ n lẹ́ o !${agent ? ` Èmi ni ${agent}${org ? ` láti ${org}` : ""}.` : ""} Báwo ni mo ṣe lè ràn yín lọ́wọ́ ?`,
    },
    "ha-NG": {
      hello: "Sannu !",
      full: `Sannu !${agent ? ` Ni ne ${agent}${org ? ` daga ${org}` : ""}.` : ""} Ta yaya zan iya taimaka muku ?`,
    },
    "wo-SN": { hello: "Asalaa maalekum !", full: "" },
  };
  const g = local[l.id];
  if (!g) return null;
  // Wolof : Claude est faible dans la langue seule, l'accueil passe donc toujours au français.
  if (bilingual || bilingualRequired(l.id) || !g.full) return `${g.hello} ${fr}`;
  return g.full;
}

/** Phrases dites par le moteur lui-même (hors réponses de l'agent). */
export interface SystemPhrases {
  fallbackGreeting: string;
  techError: string;
  transfer: string;
  transferUnavailable: string;
  /** Répondeur, avec {agent} et {organisation}. */
  voicemail: string;
  /** Accueil d'un rappel automatique, avec {agent} et {organisation}. */
  callback: string;
  /** Remplace {organisation} quand l'entreprise n'a pas de nom. */
  ourTeam: string;
}

const FR_PHRASES: SystemPhrases = {
  fallbackGreeting: "Bonjour, comment puis-je vous aider ?",
  techError: "Je suis désolé, je rencontre un problème technique. Pouvez-vous répéter ?",
  transfer: "Je vous mets en relation avec un conseiller, ne quittez pas.",
  transferUnavailable:
    "Je ne peux pas vous mettre en relation directement pour le moment, mais je transmets votre demande : un conseiller vous recontactera.",
  voicemail:
    "Bonjour, ici {agent}, l'assistant de {organisation}. Nous avons essayé de vous joindre. Vous pouvez nous rappeler à ce numéro quand vous le souhaitez. Bonne journée.",
  callback:
    "Bonjour, ici {agent} de {organisation}. Vous avez essayé de nous joindre il y a quelques instants, je vous rappelle. Comment puis-je vous aider ?",
  ourTeam: "notre équipe",
};

const EN_PHRASES: SystemPhrases = {
  fallbackGreeting: "Hello, how can I help you?",
  techError: "I'm sorry, I'm having a technical problem. Could you say that again?",
  transfer: "I'm putting you through to an advisor, please hold.",
  transferUnavailable:
    "I can't put you through directly right now, but I'm passing on your request: an advisor will get back to you.",
  voicemail:
    "Hello, this is {agent}, the assistant at {organisation}. We tried to reach you. You can call us back on this number whenever suits you. Have a good day.",
  callback:
    "Hello, this is {agent} from {organisation}. You tried to reach us a few moments ago, so I'm calling you back. How can I help you?",
  ourTeam: "our team",
};

/**
 * Phrases du moteur dans la langue de l'agent. Anglais : en anglais. Français
 * et langues locales : en français (les langues locales sont servies en mode
 * bilingue ou avec une voix qui lit aussi le français ; pas de traduction non relue).
 */
export function systemPhrases(language: string | undefined | null): SystemPhrases {
  return languageFamily(language || "fr-FR") === "en" ? EN_PHRASES : FR_PHRASES;
}
