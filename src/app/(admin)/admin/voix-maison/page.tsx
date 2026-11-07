import Link from "next/link";
import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { InhouseSetupStatus, NewInhouseVoiceForm } from "@/components/admin/inhouse-voices";
import { listInhouseVoices } from "@/lib/voices/inhouse/store";
import { formatDuration } from "@/lib/voices/inhouse/rules";
import { callpmeTtsConfigured } from "@/lib/voice-engine/callpme-tts";
import { trainingConfigured } from "@/lib/voices/inhouse/worker";

export const metadata = { title: "Voix maison" };
export const dynamic = "force-dynamic";

const JOB: Record<string, string> = {
  queued: "En attente",
  submitted: "Envoyé",
  running: "En cours",
  succeeded: "Réussi",
  failed: "Échec",
  canceled: "Annulé",
};

export default async function InhouseVoicesPage() {
  const voices = await listInhouseVoices();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Voix maison"
        description="Nos propres voix : un locuteur réel qui a signé son consentement, un jeu de données enregistré, un entraînement sur nos machines, puis une publication au catalogue. ElevenLabs reste la voix par défaut tant qu'aucune voix maison n'est publiée."
      />
      <InhouseSetupStatus inference={callpmeTtsConfigured()} training={trainingConfigured()} />
      <NewInhouseVoiceForm />
      <Card className="p-0">
        {voices.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">Aucune voix maison pour l&apos;instant.</p>
        ) : (
          <ul className="divide-y divide-border">
            {voices.map((v) => (
              <li key={v.id}>
                <Link href={`/admin/voix-maison/${v.id}`} className="flex flex-wrap items-center gap-3 p-4 hover:bg-accent/50 focus-visible:bg-accent/50">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{v.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {v.speakerName ? `Locuteur : ${v.speakerName}` : "Locuteur non renseigné"} · {v.clips} clips · {formatDuration(v.durationMs)}
                    </p>
                  </div>
                  {v.consent === "valid" && <Badge variant="success">Consentement signé</Badge>}
                  {v.consent === "missing" && <Badge variant="warning">Consentement manquant</Badge>}
                  {v.consent === "revoked" && <Badge variant="danger">Consentement révoqué</Badge>}
                  {v.lastJob && <Badge variant="outline">Entraînement : {JOB[v.lastJob] ?? v.lastJob}</Badge>}
                  {v.published > 0 && <Badge variant="brand">Publiée</Badge>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
