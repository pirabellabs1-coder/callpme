import Link from "next/link";
import Script from "next/script";
import { notFound } from "next/navigation";
import { ArrowLeft, Mic, BrainCircuit, Volume2, Info } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { getAgentById } from "@/lib/db/agents";
import { getVoice } from "@/lib/db/voices";
import { getPresetVoice } from "@/lib/voices/catalog";
import { hasLLMKey } from "@/lib/llm/chat";
import { MODELS } from "@/lib/agents/catalog";
import { Card } from "@/components/ui/card";
import { TestCallPanel } from "@/components/agents/test-call-panel";
import { CloneServerConfig } from "@/components/agents/clone-server-config";

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
  // Le cerveau réel : clé serveur si présente, sinon Claude via Puter (client).
  const modelLabel = hasServerKey ? configuredLabel : "Claude Sonnet 4.5 · Puter";
  const liveMode = true;
  const roleLabel =
    agent.role === "custom"
      ? agent.config.customRole?.label || "Rôle personnalisé"
      : undefined;

  // Si la voix de l'agent pointe vers une voix du Studio, on applique ses
  // réglages (hauteur, gain, voix système) pendant le test.
  const studioVoice = agent.config.voice.voiceId
    ? await getVoice(session.org.id, agent.config.voice.voiceId)
    : null;
  const preset = getPresetVoice(agent.config.voice.voiceId);
  let studioSettings: {
    pitch?: number;
    gain?: number;
    voiceURI?: string;
    externalVoiceId?: string;
  } | null = null;
  if (studioVoice?.settings) {
    try {
      studioSettings = JSON.parse(studioVoice.settings);
    } catch {
      studioSettings = null;
    }
  }
  // Voix « par ID » d'un provider premium (audio réel si clé configurée).
  const providerVoice =
    studioVoice &&
    ["elevenlabs", "cartesia", "openai"].includes(studioVoice.provider) &&
    studioSettings?.externalVoiceId
      ? { provider: studioVoice.provider, externalVoiceId: studioSettings.externalVoiceId }
      : null;
  const voiceProfile = {
    rate: agent.config.voice.speed ?? 1,
    pitch: studioSettings?.pitch ?? preset?.pitch,
    gain: studioSettings?.gain,
    voiceURI: studioSettings?.voiceURI,
    provider: providerVoice?.provider,
    externalVoiceId: providerVoice?.externalVoiceId,
  };

  return (
    <div className="space-y-6">
      {/* Cerveau Claude (Puter) chargé côté client — aucune clé API requise. */}
      <Script src="https://js.puter.com/v2/" strategy="afterInteractive" />
      <Link
        href={`/agents/${agent.id}`}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Retour à l'agent
      </Link>

      <div>
        <h1 className="text-display-sm font-semibold tracking-tight">
          Tester {agent.name}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Parlez en direct avec votre agent dans le navigateur, avant de le
          déployer sur un vrai numéro.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <TestCallPanel
            agentId={agent.id}
            agentName={agent.name}
            role={agent.role}
            roleLabel={roleLabel}
            firstMessage={agent.config.firstMessage}
            firstSpeaker={agent.config.firstSpeaker ?? "agent"}
            language={agent.config.voice.language}
            liveMode={liveMode}
            modelLabel={modelLabel}
            voiceProfile={voiceProfile}
            voiceGender={studioVoice?.gender ?? preset?.gender ?? null}
            studioActive={Boolean(studioVoice)}
            voiceSampleUrl={studioVoice?.sampleUrl ?? null}
            maxDurationSec={agent.config.maxDurationSec}
          />
        </div>

        <div className="space-y-5 lg:col-span-2">
          {studioVoice?.sampleUrl && <CloneServerConfig />}
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
                {!hasServerKey && (
                  <>
                    {" "}
                    Le cerveau Claude est fourni par Puter : à la première
                    réponse, autorisez l'accès dans la fenêtre Puter (gratuit,
                    sans clé API).
                  </>
                )}
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
