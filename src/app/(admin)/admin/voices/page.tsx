import { listPlatformVoices } from "@/lib/voices/platform";
import { hasElevenLabs } from "@/lib/voices/elevenlabs";
import { PageHeader } from "@/components/dashboard/page-header";
import { AdminVoiceLibrary } from "@/components/admin/admin-voice-library";

export const metadata = { title: "Voix" };
export const dynamic = "force-dynamic";

export default async function AdminVoicesPage() {
  const voices = await listPlatformVoices();
  return (
    <div className="space-y-6">
      <PageHeader
        title="Voix de la plateforme"
        description="Le catalogue de voix proposé à tous les clients. Chaque voix est une vraie voix ElevenLabs : l'aperçu est exactement ce qu'entend l'appelant."
      />
      <AdminVoiceLibrary
        configured={hasElevenLabs()}
        catalogExternalIds={voices.map((v) => v.externalId)}
        catalog={voices.map((v) => ({
          id: v.id,
          name: v.name,
          description: v.description,
          gender: v.gender,
          age: v.age,
          accent: v.accent,
          useCase: v.useCase,
          previewUrl: v.previewUrl,
          active: v.active,
        }))}
      />
    </div>
  );
}
