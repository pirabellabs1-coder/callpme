/**
 * Cerveau conversationnel de l'agent.
 *
 * - Si une clé LLM (OpenAI / Anthropic / Mistral) est présente dans
 *   l'environnement, l'agent répond avec le vrai modèle.
 * - Sinon, un moteur de dialogue intégré, conscient du rôle, conduit une
 *   vraie conversation en français (prise de RDV, support, vente…).
 *
 * Aucune dépendance SDK : appels via API REST.
 */
import type { AgentRole, JSONSchema, ModelConfig } from "../shared/types";
import { pickLocalTool } from "./local-tools";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** Outil exposé au modèle (built-in ou fonction personnalisée). */
export interface ResolvedTool {
  name: string;
  description: string;
  parameters: JSONSchema;
}

/** Appel d'outil effectivement réalisé pendant le tour. */
export interface ToolInvocation {
  name: string;
  arguments: Record<string, unknown>;
  /** Résultat lisible, affiché dans le transcript. */
  message: string;
}

/** Exécute un outil et renvoie son résultat. Fourni par la route. */
export type ToolExecutor = (
  name: string,
  args: Record<string, unknown>,
) => Promise<{ message: string; data?: Record<string, unknown> }>;

export interface GenerateResult {
  text: string;
  toolCalls: ToolInvocation[];
}

type Provider = "openai" | "anthropic" | "mistral";

/** Clé d'environnement par provider (vide => indisponible). */
const ENV_KEY: Record<Provider, () => string | undefined> = {
  openai: () => process.env.OPENAI_API_KEY || undefined,
  anthropic: () => process.env.ANTHROPIC_API_KEY || undefined,
  mistral: () => process.env.MISTRAL_API_KEY || undefined,
};

/** Une seule clé LLM (n'importe quel provider) suffit à alimenter tous les agents. */
export function anyLLMKey(): boolean {
  return Boolean(ENV_KEY.anthropic() || ENV_KEY.openai() || ENV_KEY.mistral());
}

/**
 * Vrai dès qu'un vrai modèle peut répondre. On garde le paramètre `provider`
 * pour compat, mais la décision se base sur la présence de N'IMPORTE quelle clé
 * (l'opérateur fournit une clé unique qui sert tous les agents).
 */
export function hasLLMKey(_provider?: string): boolean {
  return anyLLMKey();
}

/**
 * Provider réellement utilisable : celui configuré sur l'agent si sa clé est
 * présente, sinon le premier provider dont la clé est disponible. Ainsi une
 * unique clé (ex. Anthropic) fait fonctionner même les agents configurés OpenAI.
 */
function resolveProvider(configured: string): Provider | null {
  const all: Provider[] = ["anthropic", "openai", "mistral"];
  const order = (all.includes(configured as Provider) ? [configured as Provider] : []).concat(
    all.filter((p) => p !== configured),
  );
  for (const p of order) if (ENV_KEY[p]()) return p;
  return null;
}

/**
 * Identifiant de modèle valide pour le provider effectif. Si l'agent a été
 * configuré pour un autre provider (ex. « gpt-4o » alors qu'on bascule sur
 * Anthropic), on substitue un modèle par défaut cohérent.
 */
function effectiveModelId(provider: Provider, configured: string): string {
  const id = (configured || "").trim();
  if (provider === "openai") return /^(gpt|o\d|chatgpt)/i.test(id) ? id : "gpt-4o-mini";
  if (provider === "mistral")
    return /mistral|ministral|codestral/i.test(id) ? id : "mistral-small-latest";
  // anthropic — alias « -latest » stable, surchargé par ANTHROPIC_MODEL au besoin.
  return /^claude/i.test(id)
    ? id
    : process.env.ANTHROPIC_MODEL || "claude-3-5-haiku-latest";
}

export async function generateReply(opts: {
  model: ModelConfig;
  role: AgentRole;
  messages: ChatMessage[];
  tools?: ResolvedTool[];
  executeTool?: ToolExecutor;
}): Promise<GenerateResult> {
  const { model, role, messages, tools = [], executeTool } = opts;
  const provider = resolveProvider(model.provider);
  if (provider) {
    const eff: ModelConfig = {
      ...model,
      provider,
      modelId: effectiveModelId(provider, model.modelId),
    };
    try {
      if (provider === "openai")
        return await openAICompatible("https://api.openai.com/v1/chat/completions", ENV_KEY.openai()!, eff, messages, tools, executeTool);
      if (provider === "mistral")
        return await openAICompatible("https://api.mistral.ai/v1/chat/completions", ENV_KEY.mistral()!, eff, messages, tools, executeTool);
      if (provider === "anthropic")
        return await anthropic(eff, messages, tools, executeTool);
    } catch {
      /* clé/modèle invalide ou réseau : repli sur le moteur intégré */
    }
  }
  return localFlow(role, messages, tools, executeTool);
}

/* ----------------------------- Providers REST ---------------------------- */

/** Flux OpenAI / Mistral (format compatible) avec function calling réel. */
async function openAICompatible(
  url: string,
  key: string,
  model: ModelConfig,
  messages: ChatMessage[],
  tools: ResolvedTool[],
  executeTool?: ToolExecutor,
): Promise<GenerateResult> {
  const toolDefs = tools.map((t) => ({
    type: "function",
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }));
  const convo: unknown[] = [...messages];
  const made: ToolInvocation[] = [];

  for (let round = 0; round < 4; round++) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: model.modelId,
        temperature: model.temperature,
        messages: convo,
        tools: toolDefs.length ? toolDefs : undefined,
        max_tokens: 500,
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) throw new Error(`LLM ${res.status}`);
    const data = await res.json();
    const msg = data.choices?.[0]?.message;
    const calls = msg?.tool_calls as
      | { id: string; function: { name: string; arguments: string } }[]
      | undefined;

    if (calls?.length && executeTool) {
      convo.push(msg);
      for (const c of calls) {
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(c.function.arguments || "{}");
        } catch {
          /* arguments illisibles */
        }
        const r = await executeTool(c.function.name, args);
        made.push({ name: c.function.name, arguments: args, message: r.message });
        convo.push({
          role: "tool",
          tool_call_id: c.id,
          content: JSON.stringify(r.data ?? { message: r.message }),
        });
      }
      continue; // relance pour la réponse finale
    }
    return { text: (msg?.content as string) || "Pardon, pouvez-vous répéter ?", toolCalls: made };
  }
  return { text: "Pardon, pouvez-vous répéter ?", toolCalls: made };
}

/** Flux Anthropic avec tool use réel. */
async function anthropic(
  model: ModelConfig,
  messages: ChatMessage[],
  tools: ResolvedTool[],
  executeTool?: ToolExecutor,
): Promise<GenerateResult> {
  const system = messages.find((m) => m.role === "system")?.content;
  const conv: { role: "user" | "assistant"; content: unknown }[] = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content,
    }));
  const toolDefs = tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.parameters,
  }));
  const made: ToolInvocation[] = [];

  for (let round = 0; round < 4; round++) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: model.modelId,
        system,
        messages: conv,
        tools: toolDefs.length ? toolDefs : undefined,
        max_tokens: 500,
        temperature: model.temperature,
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) throw new Error(`LLM ${res.status}`);
    const data = await res.json();
    const blocks = (data.content ?? []) as {
      type: string;
      text?: string;
      id?: string;
      name?: string;
      input?: Record<string, unknown>;
    }[];
    const uses = blocks.filter((b) => b.type === "tool_use");

    if (uses.length && executeTool) {
      conv.push({ role: "assistant", content: blocks });
      const results: unknown[] = [];
      for (const use of uses) {
        const args = use.input ?? {};
        const r = await executeTool(use.name ?? "", args);
        made.push({ name: use.name ?? "", arguments: args, message: r.message });
        results.push({
          type: "tool_result",
          tool_use_id: use.id,
          content: JSON.stringify(r.data ?? { message: r.message }),
        });
      }
      conv.push({ role: "user", content: results });
      continue;
    }
    const text = blocks.find((b) => b.type === "text")?.text;
    return { text: text || "Pardon, pouvez-vous répéter ?", toolCalls: made };
  }
  return { text: "Pardon, pouvez-vous répéter ?", toolCalls: made };
}

/* --------------------- Moteur de dialogue intégré + outils --------------- */

async function localFlow(
  role: AgentRole,
  messages: ChatMessage[],
  tools: ResolvedTool[],
  executeTool?: ToolExecutor,
): Promise<GenerateResult> {
  const base = localReply(role, messages);
  if (!tools.length || !executeTool) return { text: base, toolCalls: [] };

  const userMsgs = messages.filter((m) => m.role === "user");
  const latest = userMsgs[userMsgs.length - 1]?.content ?? "";
  const pick = pickLocalTool(
    role,
    latest,
    messages,
    tools.map((t) => t.name),
  );
  if (!pick) return { text: base, toolCalls: [] };

  const r = await executeTool(pick.name, pick.args);
  return {
    text: pick.reply ?? base,
    toolCalls: [{ name: pick.name, arguments: pick.args, message: r.message }],
  };
}

/* --------------------- Moteur de dialogue intégré ------------------------ */

function localReply(role: AgentRole, messages: ChatMessage[]): string {
  const userMsgs = messages.filter((m) => m.role === "user");
  const u = (userMsgs[userMsgs.length - 1]?.content ?? "").toLowerCase();
  const turn = userMsgs.length; // nombre de prises de parole de l'appelant

  // Surcharges globales
  if (/\b(robot|intelligence artificielle|une ia|un bot)\b/.test(u))
    return "Oui, je suis un agent vocal intelligent. Je suis là pour vous aider — que puis-je faire pour vous ?";
  if (turn > 1 && /\b(au revoir|merci beaucoup|c'est tout|rien d'autre|bonne journée|bonne soirée)\b/.test(u))
    return "Avec plaisir, je vous souhaite une très bonne journée et à bientôt !";

  switch (role) {
    case "appointment":
      return appointment(turn, u);
    case "support":
      return support(turn, u);
    case "lead_qualification":
      return qualification(turn, u);
    case "outbound_sales":
      return sales(turn, u);
    case "receptionist":
      return receptionist(turn, u);
    case "survey":
      return survey(turn, u);
    default:
      return generic(turn, u);
  }
}

function appointment(turn: number, u: string): string {
  if (/annul/.test(u)) return "Bien sûr, je peux annuler. Pouvez-vous me donner votre nom et la date du rendez-vous ?";
  if (/déplac|report/.test(u)) return "Pas de problème pour le déplacer. Pour quelle nouvelle date souhaitez-vous le reprogrammer ?";
  switch (turn) {
    case 1:
      return "Avec plaisir. Vous préférez plutôt en début ou en fin de semaine ?";
    case 2:
      return "Très bien. Le matin ou l'après-midi vous conviendrait le mieux ?";
    case 3:
      return "J'ai un créneau mardi à neuf heures trente, ou jeudi à quatorze heures. Lequel préférez-vous ?";
    case 4:
      return "Parfait, je note. C'est à quel nom, s'il vous plaît ?";
    case 5:
      return "Je récapitule : mardi à neuf heures trente. Je valide le rendez-vous ?";
    default:
      return "C'est confirmé, vous recevrez un rappel par message. Puis-je faire autre chose pour vous ?";
  }
}

function support(turn: number, u: string): string {
  if (/commande|colis|livraison|suivi/.test(u))
    return "Je regarde tout de suite. Pouvez-vous me communiquer votre numéro de commande ?";
  if (/\b\d{4,}\b/.test(u))
    return "Merci. Je vois votre commande : elle a été expédiée et arrive sous deux jours ouvrés. Autre chose ?";
  if (/rembours|retour/.test(u))
    return "Je comprends. Le retour est possible sous trente jours. Souhaitez-vous que je lance la procédure ?";
  switch (turn) {
    case 1:
      return "Bien sûr, je suis là pour ça. Pouvez-vous me décrire précisément votre souci ?";
    case 2:
      return "D'accord, je vois. Depuis quand rencontrez-vous ce problème ?";
    case 3:
      return "Merci pour ces précisions. Je vais pouvoir vous aider — laissez-moi vérifier votre dossier.";
    default:
      return "C'est noté, je m'en occupe. Avez-vous une autre question ?";
  }
}

function qualification(turn: number, u: string): string {
  switch (turn) {
    case 1:
      return "Merci de votre intérêt ! En quelques mots, quel est votre besoin principal ?";
    case 2:
      return "Très clair. Avez-vous une idée du budget mensuel que vous envisagez ?";
    case 3:
      return "Parfait. Et pour une mise en place, vous visez plutôt quand ?";
    case 4:
      return "Super, j'ai tout ce qu'il me faut. Un conseiller va vous recontacter très vite. Quel est le meilleur moment pour vous joindre ?";
    default:
      return "C'est noté, merci ! Vous serez rappelé à ce moment-là. Excellente journée !";
  }
}

function sales(turn: number, u: string): string {
  if (/pas intéress|non merci|pas le temps|rappel|plus tard/.test(u))
    return "Je comprends tout à fait, je ne vais pas vous déranger plus longtemps. Souhaitez-vous que je vous rappelle à un moment plus opportun ?";
  switch (turn) {
    case 1:
      return "En une phrase : nous aidons les entreprises à ne plus jamais rater un appel grâce à des agents vocaux. Est-ce que ça vous parle ?";
    case 2:
      return "Beaucoup de nos clients gagnent plusieurs heures par semaine. Seriez-vous ouvert à un court essai gratuit ?";
    case 3:
      return "Parfait ! Je vous propose qu'un conseiller vous montre ça en quinze minutes. Préférez-vous cette semaine ou la suivante ?";
    default:
      return "C'est calé, vous recevrez une confirmation par e-mail. Merci pour votre temps et à très vite !";
  }
}

function receptionist(turn: number, u: string): string {
  if (/commercial|vente/.test(u)) return "Très bien, je vous mets en relation avec le service commercial, un instant je vous prie.";
  if (/support|technique|aide/.test(u)) return "Je vous transfère au support technique, ne quittez pas.";
  if (/comptab|factur/.test(u)) return "Je vous passe le service comptabilité, un instant.";
  switch (turn) {
    case 1:
      return "Bien sûr. Quel service ou quelle personne souhaitez-vous joindre ?";
    case 2:
      return "Je vérifie sa disponibilité… Souhaitez-vous que je prenne un message si la personne est occupée ?";
    default:
      return "C'est noté, je transmets votre demande. Puis-je faire autre chose pour vous ?";
  }
}

function survey(turn: number, u: string): string {
  switch (turn) {
    case 1:
      return "Merci ! Sur une échelle de zéro à dix, recommanderiez-vous nos services à un proche ?";
    case 2:
      return "C'est noté. Et qu'est-ce qui a le plus compté dans votre expérience ?";
    case 3:
      return "Merci pour ce retour précieux. Une dernière chose : y a-t-il un point que nous pourrions améliorer ?";
    default:
      return "Merci beaucoup d'avoir pris le temps de répondre. Très bonne journée à vous !";
  }
}

function generic(turn: number, u: string): string {
  if (/prix|tarif|combien/.test(u))
    return "Bonne question. Je peux vous mettre en relation avec un conseiller pour un devis précis — souhaitez-vous cela ?";
  switch (turn) {
    case 1:
      return "Je vous écoute, pouvez-vous m'en dire un peu plus sur votre demande ?";
    case 2:
      return "Très bien, je comprends. Laissez-moi vérifier comment je peux vous aider au mieux.";
    default:
      return "C'est noté. Avez-vous une autre question ?";
  }
}
