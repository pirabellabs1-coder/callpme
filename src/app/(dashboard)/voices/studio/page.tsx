import { isOrgAdmin, requireSession } from "@/lib/auth/session";
import { studioBaseVoices } from "@/lib/voices/studio-page";
import { DEFAULT_TUNING } from "@/lib/voices/tuning";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card } from "@/components/ui/card";
import { VoiceStudio } from "@/components/voices/voice-studio";

export const metadata = { title: "Studio de voix" };
export const dynamic = "force-dynamic";

export default async function NewStudioVoicePage({ searchParams }: { searchParams: { base?: string } }) {
  const session = await requireSession();
  const bases = await studioBaseVoices();
  const base = bases.find((v) => v.id === searchParams.base) ?? bases[0];

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumb={[{ label: "Voix", href: "/voices" }, { label: "Studio" }]}
        title="Studio de voix"
        description="Partez d'une voix du catalogue, réglez son ton, sa vitesse et sa prononciation, écoutez, puis enregistrez-la pour vos agents."
      />
      {base ? (
        <VoiceStudio
          baseVoices={bases}
          canEdit={isOrgAdmin(session)}
          initial={{ name: `${base.name} personnalisée`, description: "", baseVoiceId: base.id, tuning: DEFAULT_TUNING, pronunciations: [] }}
        />
      ) : (
        <Card className="p-6 text-sm text-muted-foreground">Le catalogue de voix est en cours de préparation. Revenez très bientôt.</Card>
      )}
    </div>
  );
}
