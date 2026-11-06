import { notFound } from "next/navigation";
import { isOrgAdmin, requireSession } from "@/lib/auth/session";
import { getVoice } from "@/lib/db/voices";
import { studioBaseVoices } from "@/lib/voices/studio-page";
import { parseStudioSettings } from "@/lib/voices/tuning";
import { PageHeader } from "@/components/dashboard/page-header";
import { VoiceStudio } from "@/components/voices/voice-studio";

export const metadata = { title: "Studio de voix" };
export const dynamic = "force-dynamic";

export default async function EditStudioVoicePage({ params }: { params: { id: string } }) {
  const session = await requireSession();
  const voice = await getVoice(session.org.id, params.id);
  if (!voice) notFound();
  const s = parseStudioSettings(voice.settings);
  const bases = await studioBaseVoices(s.baseVoiceId);
  // Voix d'avant le Studio (sans voix de départ connue) : on part de la première du catalogue.
  const baseVoiceId = bases.some((b) => b.id === s.baseVoiceId) ? s.baseVoiceId! : (bases[0]?.id ?? "");

  return (
    <div className="space-y-6">
      <PageHeader breadcrumb={[{ label: "Voix", href: "/voices" }, { label: voice.name }]} title={voice.name} description="Réglez la voix, écoutez le résultat, puis enregistrez : vos agents l'utilisent dès leur prochain appel." />
      <VoiceStudio
        baseVoices={bases}
        canEdit={isOrgAdmin(session)}
        initial={{
          id: voice.id,
          name: voice.name,
          description: voice.description ?? "",
          baseVoiceId,
          tuning: s.tuning,
          pronunciations: s.pronunciations,
        }}
      />
    </div>
  );
}
