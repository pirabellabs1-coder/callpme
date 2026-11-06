/**
 * Mesure du coût réel d'une minute d'appel, avec les VRAIES API.
 *
 * Rejoue une conversation de service client type avec le vrai cerveau de
 * l'agent (Claude, en flux, comme au téléphone) et la vraie analyse de fin
 * d'appel, en relevant les tokens réellement facturés. Les caractères de voix
 * sont comptés exactement comme le moteur les envoie à ElevenLabs. La durée
 * est calculée à partir du débit de parole réel (≈ 2,5 mots/s pour l'appelant,
 * ≈ 15 caractères/s pour la voix de l'agent) et d'une seconde de réaction par tour.
 *
 * Lecture seule en base (aucun appel enregistré). Coût de la mesure : quelques centimes.
 *   npx tsx scripts/mesure-couts.ts [agentId] [modèle claude optionnel]
 */
import "dotenv/config";
import { prisma } from "../src/lib/db/client";
import { getAgentById } from "../src/lib/db/agents";
import { agentReply, type Turn } from "../src/lib/voice-engine/brain";
import { analyzeCall } from "../src/lib/analysis/analyze";
import { runWithUsage } from "../src/lib/llm/usage";
import { CostMeter } from "../src/lib/costs/meter";
import { sanitizeSpoken } from "../src/lib/voice/speech-text";
import type { TranscriptTurn } from "../src/lib/shared/types";

const VOICE_STYLE =
  "## Style oral\nTu parles au téléphone : phrases courtes, une idée à la fois, pas de listes, " +
  "pas de markdown, pas d'émojis. Annonce que tu es un assistant IA si on te le demande.";

const CALLER = [
  "Bonjour, j'appelle parce que j'ai un problème avec ma commande.",
  "Je l'ai passée la semaine dernière et je n'ai toujours rien reçu.",
  "Oui, c'est au nom de Koffi Mensah, j'habite à Cotonou, quartier Akpakpa.",
  "Le numéro de commande, attendez… c'est 4 8 2 7.",
  "D'accord. Et vous savez quand elle va arriver à peu près ?",
  "Est-ce que je peux être livré au bureau plutôt qu'à la maison ?",
  "C'est à Ganhi, près du marché. Je suis là de huit heures à dix-sept heures.",
  "Et si je ne suis pas là, le livreur peut m'appeler sur ce numéro ?",
  "Très bien. Une dernière chose, est-ce que je peux payer par Mobile Money à la livraison ?",
  "Parfait, merci beaucoup pour votre aide. Bonne journée.",
];

async function main() {
  const [agentIdArg, modelArg] = process.argv.slice(2);
  const row = agentIdArg
    ? { id: agentIdArg }
    : await prisma.agent.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true } });
  if (!row) throw new Error("Aucun agent en base.");
  const loaded = await getAgentById(row.id);
  if (!loaded) throw new Error("Agent introuvable.");
  const agent = modelArg ? { ...loaded, config: { ...loaded.config, model: { ...loaded.config.model, provider: "anthropic" as const, modelId: modelArg } } } : loaded;

  const meter = new CostMeter();
  const history: Turn[] = [];
  const transcript: TranscriptTurn[] = [];
  let seconds = 0;

  const agentSays = (text: string) => {
    meter.addTts(text);
    seconds += text.length / 15;
    transcript.push({ speaker: "agent", text, at: Math.round(seconds) });
  };

  if (agent.config.firstSpeaker !== "caller" && agent.config.firstMessage) {
    const greeting = sanitizeSpoken(agent.config.firstMessage, {});
    agentSays(greeting);
    history.push({ role: "assistant", content: greeting });
  }

  for (const line of CALLER) {
    seconds += line.split(/\s+/).length / 2.5 + 1;
    history.push({ role: "user", content: line });
    transcript.push({ speaker: "caller", text: line, at: Math.round(seconds) });
    const parts: string[] = [];
    const result = await runWithUsage((u) => meter.addLlm(u), () =>
      agentReply(
        {
          agent,
          organizationId: agent.organizationId,
          callId: "mesure-couts",
          callerNumber: "+22997000000",
          extraInstructions: VOICE_STYLE,
          test: true,
          onText: (d) => parts.push(d),
        },
        history,
      ),
    );
    const text = sanitizeSpoken(result.streamed ? parts.join("") : result.text, {});
    agentSays(text);
    history.push({ role: "assistant", content: text });
  }

  await runWithUsage((u) => meter.addLlm(u), () => analyzeCall(agent, transcript, Math.round(seconds)));

  const minutes = seconds / 60;
  const inbound = meter.summary({ durationSec: seconds, direction: "inbound", to: "+33100000000" });
  const web = meter.summary({ durationSec: seconds, direction: "web", to: "" });
  const benin = meter.summary({ durationSec: seconds, direction: "outbound", to: "+22997000000" });
  const perMin = (usd: number) => (usd / minutes) * inbound.usdToEur;

  console.log(JSON.stringify({
    agent: agent.name,
    model: inbound.units.models,
    durationMin: Math.round(minutes * 100) / 100,
    units: inbound.units,
    usd: inbound.usd,
    eurPerMinute: {
      llm: perMin(inbound.usd.llm),
      tts: perMin(inbound.usd.tts),
      stt: perMin(inbound.usd.stt),
      telephonyInboundFR: perMin(inbound.usd.telephony),
      totalInboundFR: perMin(inbound.usd.total),
      totalWebNoPhone: perMin(web.usd.total),
      totalOutboundBenin: perMin(benin.usd.total),
    },
  }, null, 2));
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e instanceof Error ? e.message : e);
  await prisma.$disconnect();
  process.exit(1);
});
