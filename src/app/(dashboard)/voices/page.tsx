import { requireSession } from "@/lib/auth/session";
import { listVoices } from "@/lib/db/voices";
import { PageHeader } from "@/components/dashboard/page-header";
import { VoiceStudio } from "@/components/voices/voice-studio";

export const metadata = { title: "Studio Voix" };
export const dynamic = "force-dynamic";

export default async function VoicesPage() {
  const session = await requireSession();
  const voices = await listVoices(session.org.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Studio Voix"
        description="Entraînez des voix sur-mesure et utilisez-les dans vos agents."
      />
      <VoiceStudio initial={voices} />
    </div>
  );
}
