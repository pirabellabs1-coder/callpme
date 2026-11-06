import { notFound } from "next/navigation";
import { PageHeader } from "@/components/dashboard/page-header";
import {
  ConsentSection,
  DatasetSection,
  InhouseSetupStatus,
  TrainingSection,
  VersionsSection,
} from "@/components/admin/inhouse-voices";
import { getInhouseVoice } from "@/lib/voices/inhouse/store";
import { BASE_MODELS, consentValid, trainingBlocker, TRAINING_MINIMUM, isActiveJob, CONSENT_FORM_VERSION } from "@/lib/voices/inhouse/rules";
import { callpmeTtsConfigured } from "@/lib/voice-engine/callpme-tts";
import { trainingConfigured } from "@/lib/voices/inhouse/worker";

export const metadata = { title: "Voix maison" };
export const dynamic = "force-dynamic";

export default async function InhouseVoicePage({ params }: { params: { id: string } }) {
  const voice = await getInhouseVoice(params.id);
  if (!voice) notFound();
  const dataset = {
    clips: voice.clips.length,
    durationMs: voice.clips.reduce((sum, c) => sum + (c.durationMs ?? 0), 0),
  };
  const activeJob = voice.jobs.some((j) => isActiveJob(j.status));
  const inference = callpmeTtsConfigured();
  const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

  return (
    <div className="space-y-6">
      <PageHeader
        title={voice.name}
        description={voice.description ?? "Voix maison Callpme."}
        breadcrumb={[{ label: "Voix maison", href: "/admin/voix-maison" }, { label: voice.name }]}
      />
      <InhouseSetupStatus inference={inference} training={trainingConfigured()} />
      <ConsentSection
        voiceId={voice.id}
        formVersion={CONSENT_FORM_VERSION}
        consent={
          voice.consent
            ? {
                speakerName: voice.consent.speakerName,
                speakerContact: voice.consent.speakerContact,
                formVersion: voice.consent.formVersion,
                signedAt: voice.consent.signedAt.toISOString(),
                documentName: voice.consent.documentName,
                revokedAt: iso(voice.consent.revokedAt),
                revokeReason: voice.consent.revokeReason,
              }
            : null
        }
      />
      <DatasetSection
        voiceId={voice.id}
        canAdd={consentValid(voice.consent)}
        speakerName={voice.consent?.speakerName ?? null}
        minimum={TRAINING_MINIMUM}
        dataset={dataset}
        clips={voice.clips.map((c) => ({
          id: c.id,
          transcript: c.transcript,
          durationMs: c.durationMs,
          source: c.source,
          sizeBytes: c.sizeBytes,
          createdAt: c.createdAt.toISOString(),
        }))}
      />
      <TrainingSection
        voiceId={voice.id}
        baseModels={BASE_MODELS.map((m) => ({ id: m.id, label: m.label }))}
        blocker={trainingBlocker({ consent: voice.consent, dataset, hasActiveJob: activeJob })}
        inference={inference}
        jobs={voice.jobs.map((j) => ({
          id: j.id,
          status: j.status,
          baseModel: j.baseModel,
          clipCount: j.clipCount,
          totalDurationMs: j.totalDurationMs,
          progress: j.progress,
          message: j.message,
          createdAt: j.createdAt.toISOString(),
          finishedAt: iso(j.finishedAt),
        }))}
      />
      <VersionsSection
        inference={inference}
        canPublish={consentValid(voice.consent)}
        versions={voice.versions.map((v) => ({
          id: v.id,
          number: v.number,
          modelRef: v.modelRef,
          status: v.status,
          notes: v.notes,
          publishedAt: iso(v.publishedAt),
        }))}
      />
    </div>
  );
}
