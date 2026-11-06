/**
 * Parcours de conversation (constructeur visuel).
 *
 * Un parcours est une suite de blocs reliés : message, question, choix,
 * action (outil), transfert, fin. Pendant l'appel, il est traduit en
 * consignes étape par étape ajoutées au prompt de l'agent ; les outils qu'il
 * demande sont activés automatiquement. Module pur, utilisable côté client.
 */
import { z } from "zod";
import type { AgentRole, ConversationFlow, FlowNode, FlowNodeType } from "../shared/types";

export const FLOW_LIMITS = { nodes: 40, edgesPerNode: 6, title: 60, instruction: 800, condition: 160 } as const;

export const NODE_TYPES: Record<FlowNodeType, { label: string; hint: string }> = {
  message: { label: "Message", hint: "L'agent dit quelque chose puis continue." },
  question: { label: "Question", hint: "L'agent pose une question et note la réponse." },
  decision: { label: "Choix", hint: "La suite dépend de ce que dit l'appelant." },
  action: { label: "Action", hint: "L'agent utilise un outil (agenda, SMS, CRM…)." },
  transfer: { label: "Transfert", hint: "L'appel est passé à un conseiller." },
  end: { label: "Fin", hint: "L'agent conclut et raccroche." },
};

/** Outils associés automatiquement : une réservation demande aussi la vérification des créneaux. */
const TOOL_COMPANIONS: Record<string, string[]> = {
  bookAppointment: ["checkAvailability", "bookAppointment"],
};

const id = z.string().regex(/^[a-z0-9_-]{1,24}$/, "Identifiant de bloc invalide");
const text = (max: number) => z.string().trim().max(max);

export const flowSchema = z.object({
  enabled: z.boolean(),
  start: id,
  nodes: z
    .array(
      z.object({
        id,
        type: z.enum(["message", "question", "decision", "action", "transfer", "end"]),
        title: text(FLOW_LIMITS.title).min(1, "Titre requis"),
        instruction: text(FLOW_LIMITS.instruction),
        variable: z
          .string()
          .regex(/^[a-z0-9_]{1,40}$/, "Clé à relever : lettres minuscules, chiffres et _")
          .optional(),
        tool: z.string().regex(/^[A-Za-z0-9_]{1,80}$/).optional(),
        next: z
          .array(z.object({ to: id, when: text(FLOW_LIMITS.condition).optional() }))
          .max(FLOW_LIMITS.edgesPerNode),
        position: z.object({ x: z.number().finite().min(-5000).max(20000), y: z.number().finite().min(-5000).max(20000) }),
      }),
    )
    .min(1, "Le parcours est vide")
    .max(FLOW_LIMITS.nodes, `${FLOW_LIMITS.nodes} blocs au maximum`),
});

export interface FlowIssue {
  nodeId?: string;
  message: string;
}

/**
 * Contrôle de cohérence. Les erreurs empêchent l'enregistrement ; les
 * avertissements signalent un parcours probablement incomplet.
 */
export function checkFlow(
  flow: ConversationFlow,
  knownTools: string[],
  opts: { hasTransferNumber?: boolean } = {},
): { errors: FlowIssue[]; warnings: FlowIssue[] } {
  const errors: FlowIssue[] = [];
  const warnings: FlowIssue[] = [];
  const ids = new Set<string>();
  for (const n of flow.nodes) {
    if (ids.has(n.id)) errors.push({ nodeId: n.id, message: `Deux blocs portent l'identifiant « ${n.id} ».` });
    ids.add(n.id);
  }
  if (!ids.has(flow.start)) errors.push({ message: "Le bloc de départ n'existe pas : définissez-en un." });
  const titles = new Map<string, number>();
  for (const n of flow.nodes) titles.set(n.title.trim().toLowerCase(), (titles.get(n.title.trim().toLowerCase()) ?? 0) + 1);

  for (const n of flow.nodes) {
    const name = `« ${n.title.trim() || n.id} »`;
    if (!n.title.trim()) errors.push({ nodeId: n.id, message: `Le bloc ${n.id} n'a pas de nom.` });
    else if ((titles.get(n.title.trim().toLowerCase()) ?? 0) > 1) {
      warnings.push({ nodeId: n.id, message: `${name} : plusieurs étapes portent ce nom, renommez-les pour les distinguer.` });
    }
    if (new Set(n.next.map((e) => e.to)).size < n.next.length) {
      warnings.push({ nodeId: n.id, message: `${name} mène deux fois au même bloc.` });
    }
    if (n.type === "transfer" && opts.hasTransferNumber === false) {
      warnings.push({ nodeId: n.id, message: `${name} : aucun numéro de transfert n'est configuré (onglet Configuration). L'agent prendra un message à la place.` });
    }
    for (const e of n.next) {
      if (!ids.has(e.to)) errors.push({ nodeId: n.id, message: `${name} mène à un bloc supprimé.` });
      if (e.to === n.id) errors.push({ nodeId: n.id, message: `${name} ne peut pas mener à lui-même.` });
    }
    if (n.type === "action" && (!n.tool || !knownTools.includes(n.tool))) {
      errors.push({ nodeId: n.id, message: `${name} : choisissez l'outil à utiliser.` });
    }
    if (n.type === "question" && !n.variable) warnings.push({ nodeId: n.id, message: `${name} : indiquez l'information à relever.` });
    if ((n.type === "end" || n.type === "transfer") && n.next.length) {
      warnings.push({ nodeId: n.id, message: `${name} termine l'appel : ses suites ne seront jamais utilisées.` });
    }
    if (n.type !== "end" && n.type !== "transfer" && !n.next.length) {
      warnings.push({ nodeId: n.id, message: `${name} n'a pas de suite.` });
    }
    if (n.next.length > 1 && n.next.some((e) => !e.when?.trim())) {
      warnings.push({ nodeId: n.id, message: `${name} a plusieurs suites : précisez la condition de chacune.` });
    }
    if (!n.instruction.trim() && n.type !== "end") warnings.push({ nodeId: n.id, message: `${name} n'a pas de consigne.` });
  }

  // Blocs jamais atteints depuis le départ.
  const reached = new Set<string>();
  const byId = new Map(flow.nodes.map((n) => [n.id, n]));
  const stack = [flow.start];
  while (stack.length) {
    const cur = stack.pop()!;
    if (reached.has(cur) || !byId.has(cur)) continue;
    reached.add(cur);
    for (const e of byId.get(cur)!.next) stack.push(e.to);
  }
  for (const n of flow.nodes) {
    if (!reached.has(n.id)) warnings.push({ nodeId: n.id, message: `« ${n.title} » n'est jamais atteint depuis le départ.` });
  }
  return { errors, warnings };
}

/** Outils à activer pour que le parcours fonctionne (actions, transfert, fin). */
export function flowToolNames(flow: ConversationFlow | undefined): string[] {
  if (!flow?.enabled) return [];
  const out = new Set<string>();
  for (const n of flow.nodes) {
    if (n.type === "action" && n.tool) (TOOL_COMPANIONS[n.tool] ?? [n.tool]).forEach((t) => out.add(t));
    // Transfert impossible (pas de numéro, test) : l'agent prend un message à la place.
    if (n.type === "transfer") ["transferToHuman", "takeMessage", "endCall"].forEach((t) => out.add(t));
    if (n.type === "end") out.add("endCall");
  }
  return Array.from(out);
}

/** Une ligne, sans balises : le texte du parcours ne doit pas casser la structure du prompt. */
const clean = (s: string | undefined) =>
  (s ?? "")
    .replace(/<\/?[a-z][^>]*>/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

function describe(n: FlowNode, toolLabel: (name: string) => string): string {
  const what = clean(n.instruction);
  switch (n.type) {
    case "message":
      return `Dis : ${what || "(message libre, adapté à la situation)"}`;
    case "question":
      return `Demande : ${what || "(question à formuler)"}${n.variable ? ` — retiens la réponse sous « ${n.variable} »` : ""}. Attends la réponse avant de continuer.`;
    case "decision":
      return `Selon la réponse de l'appelant, choisis la suite qui correspond.${what ? ` ${what}` : ""}`;
    case "action":
      return `Utilise l'outil ${n.tool ?? ""} (${toolLabel(n.tool ?? "")}).${what ? ` ${what}` : ""} Annonce le résultat réel de l'outil, jamais un résultat supposé.`;
    case "transfer":
      return (
        `${what ? `${what} ` : ""}Rassure l'appelant en une phrase puis transfère l'appel à un conseiller (outil transferToHuman). ` +
        "Si le transfert réussit, n'utilise pas endCall : il met fin à ton rôle. S'il est impossible, propose de prendre un message (takeMessage), puis conclus et raccroche (endCall)."
      );
    case "end":
      return `Conclus poliment${what ? ` : ${what}` : ""}, puis raccroche (outil endCall).`;
  }
}

/**
 * Traduit le parcours en consignes pour le modèle. Les étapes sont nommées
 * par leur titre (jamais prononcé) et reliées par leurs conditions.
 */
export function compileFlow(flow: ConversationFlow, toolLabel: (name: string) => string = (n) => n): string {
  const byId = new Map(flow.nodes.map((n) => [n.id, n]));
  const title = (nodeId: string) => `« ${clean(byId.get(nodeId)?.title) || nodeId} »`;
  // Ordre de lecture : départ d'abord, puis parcours en largeur.
  const order: FlowNode[] = [];
  const seen = new Set<string>();
  const queue = [flow.start];
  while (queue.length) {
    const cur = byId.get(queue.shift()!);
    if (!cur || seen.has(cur.id)) continue;
    seen.add(cur.id);
    order.push(cur);
    cur.next.forEach((e) => queue.push(e.to));
  }
  // Les étapes sont désignées par leur numéro : deux étapes peuvent porter le même nom.
  const index = new Map(order.map((n, i) => [n.id, i + 1]));
  const label = (nodeId: string) => `${index.get(nodeId) ?? "?"} ${title(nodeId)}`;

  const lines = [
    "## Parcours de la conversation",
    "Conduis l'appel en suivant ces étapes, dans l'ordre indiqué par leurs suites. Reste naturel : reformule avec tes mots, " +
      "une seule question à la fois. Si l'appelant pose une question hors parcours, réponds-y brièvement puis reviens à l'étape en cours. " +
      "Ne prononce jamais le nom des étapes. Ne raccroche (endCall) qu'à une étape de fin.",
  ];
  order.forEach((n, i) => {
    lines.push("", `Étape ${label(n.id)}${n.id === flow.start ? " (début de l'appel)" : ""} : ${describe(n, toolLabel)}`);
    if (n.type === "end" || n.type === "transfer") return;
    for (const e of n.next) {
      const cond = clean(e.when);
      lines.push(cond ? `  → si ${cond} : étape ${label(e.to)}` : `  → ensuite : étape ${label(e.to)}`);
    }
  });
  return lines.join("\n");
}

/** Disposition automatique : une colonne par niveau depuis le départ. */
export function autoLayout(flow: ConversationFlow): ConversationFlow {
  const byId = new Map(flow.nodes.map((n) => [n.id, n]));
  const depth = new Map<string, number>([[flow.start, 0]]);
  const queue = [flow.start];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const e of byId.get(cur)?.next ?? []) {
      if (!depth.has(e.to) && byId.has(e.to)) {
        depth.set(e.to, (depth.get(cur) ?? 0) + 1);
        queue.push(e.to);
      }
    }
  }
  const maxDepth = Math.max(0, ...Array.from(depth.values()));
  const rows = new Map<number, number>();
  const nodes = flow.nodes.map((n) => {
    const d = depth.get(n.id) ?? maxDepth + 1;
    const r = rows.get(d) ?? 0;
    rows.set(d, r + 1);
    return { ...n, position: { x: 40 + d * 300, y: 40 + r * 170 } };
  });
  return { ...flow, nodes };
}

function node(idv: string, type: FlowNodeType, title: string, instruction: string, next: FlowNode["next"], extra: Partial<FlowNode> = {}): FlowNode {
  return { id: idv, type, title, instruction, next, position: { x: 0, y: 0 }, ...extra };
}

/** Parcours de départ selon le rôle de l'agent (à adapter dans l'éditeur). */
export function templateFlow(role: AgentRole): ConversationFlow {
  let nodes: FlowNode[];
  switch (role) {
    case "appointment":
      nodes = [
        node("accueil", "question", "Accueil", "Salue l'appelant et demande ce qui l'amène.", [{ to: "motif" }], { variable: "demande" }),
        node("motif", "question", "Motif", "Demande le motif du rendez-vous.", [
          { to: "urgence", when: "l'appelant décrit une urgence (douleur forte, saignement…)" },
          { to: "creneau", when: "la demande n'est pas urgente" },
        ], { variable: "motif" }),
        node("urgence", "transfer", "Urgence", "Rassure l'appelant et passe-le à l'équipe.", []),
        node("creneau", "action", "Proposer un créneau", "Propose deux créneaux disponibles proches de sa préférence.", [{ to: "nom" }], { tool: "checkAvailability" }),
        node("nom", "question", "Nom", "Demande le nom et le prénom pour la réservation.", [{ to: "reserver" }], { variable: "nom" }),
        node("reserver", "action", "Réserver", "Réserve le créneau choisi et donne la référence lettre par lettre.", [{ to: "fin" }], { tool: "bookAppointment" }),
        node("fin", "end", "Fin", "Rappelle la date et l'heure, puis souhaite une bonne journée.", []),
      ];
      break;
    case "lead_qualification":
    case "outbound_sales":
      nodes = [
        node("accueil", "message", "Présentation", "Présente-toi et l'entreprise en une phrase.", [{ to: "besoin" }]),
        node("besoin", "question", "Besoin", "Demande quel est son besoin principal.", [{ to: "budget" }], { variable: "besoin" }),
        node("budget", "question", "Budget", "Demande le budget envisagé.", [{ to: "delai" }], { variable: "budget" }),
        node("delai", "question", "Délai", "Demande quand il souhaite démarrer.", [
          { to: "rappel", when: "le projet est concret (budget et délai connus)" },
          { to: "fin", when: "pas de projet pour le moment" },
        ], { variable: "delai" }),
        node("rappel", "action", "Programmer un rappel", "Propose qu'un conseiller le rappelle et note le moment idéal.", [{ to: "fin" }], { tool: "scheduleCallback" }),
        node("fin", "end", "Fin", "Remercie pour son temps.", []),
      ];
      break;
    case "support":
      nodes = [
        node("accueil", "question", "Accueil", "Salue et demande la raison de l'appel.", [{ to: "probleme" }], { variable: "raison" }),
        node("probleme", "question", "Problème", "Fais décrire le problème précisément.", [
          { to: "resolu", when: "la réponse figure dans la base de connaissances" },
          { to: "ticket", when: "le problème demande une intervention de l'équipe" },
        ], { variable: "probleme" }),
        node("resolu", "message", "Réponse", "Explique la solution simplement et vérifie qu'elle convient.", [{ to: "fin" }]),
        node("ticket", "action", "Créer un ticket", "Crée un ticket avec le résumé du problème.", [{ to: "fin" }], { tool: "createTicket" }),
        node("fin", "end", "Fin", "Demande s'il y a autre chose puis conclus.", []),
      ];
      break;
    default:
      nodes = [
        node("accueil", "question", "Accueil", "Salue l'appelant et demande comment l'aider.", [
          { to: "message", when: "l'appelant veut laisser un message" },
          { to: "transfert", when: "l'appelant demande à parler à quelqu'un" },
        ], { variable: "demande" }),
        node("message", "action", "Prendre un message", "Note le message, le nom et le numéro de rappel.", [{ to: "fin" }], { tool: "takeMessage" }),
        node("transfert", "transfer", "Transfert", "Annonce que tu passes l'appel à l'équipe.", []),
        node("fin", "end", "Fin", "Confirme que le message sera transmis.", []),
      ];
  }
  return autoLayout({ enabled: true, start: nodes[0].id, nodes });
}

/** Identifiant libre pour un nouveau bloc. */
export function newNodeTitle(flow: ConversationFlow, type: FlowNodeType): string {
  const base = NODE_TYPES[type].label;
  const used = new Set(flow.nodes.map((n) => n.title.trim().toLowerCase()));
  if (!used.has(base.toLowerCase())) return base;
  for (let i = 2; ; i++) if (!used.has(`${base} ${i}`.toLowerCase())) return `${base} ${i}`;
}

export function newNodeId(flow: ConversationFlow, type: FlowNodeType): string {
  const used = new Set(flow.nodes.map((n) => n.id));
  for (let i = 1; ; i++) {
    const candidate = `${type}_${i}`;
    if (!used.has(candidate)) return candidate;
  }
}
