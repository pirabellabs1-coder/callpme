import { getSession } from "@/lib/auth/session";
import { listVoices } from "@/lib/db/voices";
import { PageHeader } from "@/components/dashboard/page-header";
import { AdminVoiceCatalog } from "@/components/admin/admin-voice-catalog";
import { VoiceStudio } from "@/components/voices/voice-studio";

export const metadata = { title: "Studio Voix" };
export const dynamic = "force-dynamic";

export default async function AdminVoicesPage() {
  const session = await getSession();
  const voices = session ? await listVoices(session.org.id) : [];
  return (
    <div className="space-y-6">
      <PageHeader
        title="Studio Voix — Administration"
        description="Écoutez le catalogue, enregistrez et mixez des voix, ajoutez des voix par ID (ElevenLabs / Cartesia / OpenAI)."
      />
      {/* Catalogue intégré écoutable */}
      <AdminVoiceCatalog />
      {/* Studio complet : enregistrement, mixage, ajout par ID, bibliothèque */}
      <VoiceStudio initial={voices} showCatalog={false} />
    </div>
  );
}
