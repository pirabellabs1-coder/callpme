import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Mic, BrainCircuit, Volume2, Info } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { getAgentById } from "@/lib/db/agents";
import { prisma } from "@/lib/db/client";
import { hasLLMKey } from "@/lib/llm/chat";
import { MODELS } from "@/lib/agents/catalog";
import { Card } from "@/components/ui/card";
import { TestCallPanel } from "@/components/agents/test-call-panel";
import { RealCallCard } from "@/components/agents/real-call-card";
import { telephonyConfigured, voiceEngineMissing } from "@/lib/telephony/provider";
import { VoiceTestPanel } from "@/components/agents/voice-test-panel";

export const metadata = { title: "Test d'appel" };
export const dynamic = "force-dynamic";

const STEPS = [
  { icon: Mic, title: "Vous parlez", text: "Votre micro est transcrit en temps réel (ou tapez au clavier)." },
  { icon: BrainCircuit, title: "L'agent comprend", text: "Le modèle raisonne avec le prompt du rôle et répond." },
  { icon: Volume2, title: "L'agent répond", text: "La réponse est lue à voix haute, dans la langue de l'agent." },
];

export default async function TestAgentPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await requireSession();
  const agent = await getAgentById(params.id);
  if (!agent || agent.organizationId !== session.org.id) notFound();

  const hasServerKey = hasLLMKey(agent.config.model.provider);
  const configuredLabel =
    MODELS[agent.config.model.provider]?.find(
      (m) => m.id === agent.config.model.modelId,
    )?.label ?? agent.config.model.modelId;
  // Le cerveau réel : clé de modèle du serveur si présente, sinon moteur local de démonstration.
  const modelLabel = hasServerKey ? configuredLabel : "Mode démonstration";
  const liveMode = true;
  const roleLabel =
    agent.role === "custom"
      ? agent.config.customRole?.label || "Rôle personnalisé"
      : undefined;

  // Voix réelle de l'agent (catalogue ou voix propre) : aperçu par le fournisseur.
  const v = agent.config.voice;
  const catalogVoice = v.providerVoiceId
    ? await prisma.platformVoice.findUnique({ where: { externalId: v.providerVoiceId }, select: { gender: true } })
    : null;
  const voiceProfile = {
    rate: v.speed ?? 1,
    provider: v.providerVoiceId ? v.provider : undefined,
    externalVoiceId: v.providerVoiceId,
  };

  // Moteur vocal Callpme configuré : c'est LE test (même moteur qu'au téléphone).
  // Le test navigateur (texte et voix du navigateur) ne reste qu'en secours, tant que le moteur manque.
  const engineReady = voiceEngineMissing().length === 0;

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Parlez en direct avec votre agent dans le navigateur, avant de le déployer sur un vrai numéro. Les
        rendez-vous et fiches créés pendant un test sont marqués « test » et ne déclenchent ni SMS ni e-mail.
      </p>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          {engineReady ? (
            <VoiceTestPanel agentId={agent.id} agentName={agent.name} />
          ) : (
          <TestCallPanel
            agentId={agent.id}
            agentName={agent.name}
            organizationName={session.org.name}
            role={agent.role}
            roleLabel={roleLabel}
            firstMessage={agent.config.firstMessage}
            firstSpeaker={agent.config.firstSpeaker ?? "agent"}
            language={agent.config.voice.language}
            liveMode={liveMode}
            modelLabel={modelLabel}
            voiceProfile={voiceProfile}
            voiceGender={catalogVoice?.gender ?? null}
            maxDurationSec={agent.config.maxDurationSec}
          />
          )}
        </div>

        <div className="space-y-5 lg:col-span-2">
          {!engineReady && (
            <Card className="p-5">
              <h2 className="text-[0.95rem] font-semibold tracking-tight">Test vocal en direct</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {session.user.isAdmin
                  ? `Moteur vocal à configurer sur le serveur : ${voiceEngineMissing().join(", ")}.`
                  : "Le test vocal au micro sera disponible très bientôt. En attendant, discutez avec votre agent par écrit ci-contre : il répond exactement comme au téléphone."}
              </p>
            </Card>
          )}
          {telephonyConfigured() && <RealCallCard agentId={agent.id} />}
          <Card className="p-5">
            <h2 className="text-[0.95rem] font-semibold tracking-tight">
              Comment ça marche
            </h2>
            <div className="mt-4 space-y-4">
              {STEPS.map((s, i) => (
                <div key={i} className="flex gap-3">
                  <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 ring-1 ring-inset ring-brand-600/15 [&_svg]:size-4">
                    <s.icon strokeWidth={1.75} />
                  </span>
                  <div>
                    <p className="text-sm font-medium text-foreground">{s.title}</p>
                    <p className="text-xs text-muted-foreground">{s.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="border-brand/20 bg-brand-50/30 p-5">
            <div className="flex items-start gap-2.5">
              <Info className="mt-0.5 size-4 shrink-0 text-brand" />
              <p className="text-xs text-muted-foreground">
                Vous parlez à l'agent exactement comme un appelant. Tout ce que
                vous avez configuré — rôle, voix, modèle{" "}
                <strong>{modelLabel}</strong>, prompt, outils et base de
                connaissances — est utilisé en direct dans la conversation.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
