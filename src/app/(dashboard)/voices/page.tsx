import Link from "next/link";
import { Plus, SlidersHorizontal } from "lucide-react";
import { isOrgAdmin, requireSession } from "@/lib/auth/session";
import { listPlatformVoices } from "@/lib/voices/platform";
import { listVoices } from "@/lib/db/voices";
import { parseStudioSettings, TUNING_PRESETS } from "@/lib/voices/tuning";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { SamplePlayButton } from "@/components/voices/sample-play-button";
import { DeleteStudioVoice } from "@/components/voices/delete-studio-voice";

export const metadata = { title: "Voix" };
export const dynamic = "force-dynamic";

const GENDER: Record<string, string> = { feminine: "Femme", masculine: "Homme", neutral: "Neutre" };
const GROUPS: { key: string; title: string }[] = [
  { key: "feminine", title: "Voix de femme" },
  { key: "masculine", title: "Voix d'homme" },
  { key: "other", title: "Autres voix" },
];

export default async function VoicesPage() {
  const session = await requireSession();
  const canEdit = isOrgAdmin(session);
  const [all, own] = await Promise.all([listPlatformVoices(), listVoices(session.org.id)]);
  // Les voix maison se choisissent dans la configuration de l'agent (pas de réglage Studio).
  const voices = all.filter((v) => v.active && v.provider !== "callpme");
  const baseName = (id?: string) => all.find((b) => b.id === id)?.name;
  const groupOf = (g: string | null) => (g === "feminine" || g === "masculine" ? g : "other");
  // Seules les vraies voix (réglées au Studio ou clonées) sont utilisables au téléphone.
  const mine = own.map((v) => ({ v, s: parseStudioSettings(v.settings) })).filter(({ s }) => s.externalVoiceId);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Voix"
        description="Écoutez les voix disponibles, puis réglez-les au Studio pour vos agents. Ce sont de vraies voix : celle que vous entendez ici est celle qu'entendront vos appelants."
      >
        {voices.length > 0 && canEdit && (
          <Link href="/voices/studio" className={buttonVariants({ variant: "brand" })}>
            <Plus aria-hidden /> Nouvelle voix
          </Link>
        )}
      </PageHeader>

      <section aria-labelledby="vg-mine" className="space-y-3">
        <h2 id="vg-mine" className="text-sm font-semibold tracking-tight">
          Mes voix <span className="font-normal text-muted-foreground">· {mine.length}</span>
        </h2>
        {mine.length === 0 ? (
          <Card className="border-dashed p-5 text-sm text-muted-foreground">
            Aucune voix personnalisée pour l&apos;instant. Choisissez une voix du catalogue ci-dessous et cliquez sur « Personnaliser »
            pour régler son ton, sa vitesse et la prononciation de vos noms propres.
          </Card>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {mine.map(({ v, s }) => {
              const preset = TUNING_PRESETS.find((p) => JSON.stringify(p.tuning) === JSON.stringify(s.tuning));
              const words = s.pronunciations.length;
              const from = baseName(s.baseVoiceId);
              return (
                <li key={v.id}>
                  <Card className="flex h-full items-start gap-3 p-4">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{v.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {[from ? `D'après ${from}` : "Voix clonée", preset ? preset.label : "Réglages sur mesure", words ? `${words} mot${words > 1 ? "s" : ""}` : null]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      {v.description && <p className="mt-1 text-sm text-muted-foreground">{v.description}</p>}
                      <Link href={`/voices/studio/${v.id}`} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-3")}>
                        <SlidersHorizontal aria-hidden /> {canEdit ? "Ouvrir au Studio" : "Voir les réglages"}
                      </Link>
                    </div>
                    {canEdit && <DeleteStudioVoice id={v.id} name={v.name} />}
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {voices.length === 0 ? (
        <Card className="p-6 text-sm text-muted-foreground">
          Le catalogue de voix est en cours de préparation par l&apos;équipe Callpme. Revenez très bientôt.
        </Card>
      ) : (
        GROUPS.map(({ key, title }) => {
          const list = voices.filter((v) => groupOf(v.gender) === key);
          if (!list.length) return null;
          return (
            <section key={key} aria-labelledby={`vg-${key}`} className="space-y-3">
              <h2 id={`vg-${key}`} className="text-sm font-semibold tracking-tight">
                {title} <span className="font-normal text-muted-foreground">· {list.length}</span>
              </h2>
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((v) => (
                  <li key={v.id}>
                    <Card className="flex h-full items-start gap-3 p-4">
                      {v.previewUrl && <SamplePlayButton src={v.previewUrl} label={`Écouter ${v.name}`} />}
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{v.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {[v.gender ? GENDER[v.gender] : null, v.accent].filter(Boolean).join(" · ") || "Voix"}
                        </p>
                        {v.description && <p className="mt-1 text-sm text-muted-foreground">{v.description}</p>}
                        {canEdit && (
                          <Link
                            href={`/voices/studio?base=${encodeURIComponent(v.id)}`}
                            className="mt-2 inline-flex items-center gap-1 text-sm text-brand-700 hover:underline"
                          >
                            <SlidersHorizontal className="size-3.5" aria-hidden /> Personnaliser
                            <span className="sr-only"> {v.name}</span>
                          </Link>
                        )}
                      </div>
                    </Card>
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}

      <Card className="border-dashed p-5 text-sm text-muted-foreground">
        Pour donner une voix à un agent, ouvrez l&apos;agent puis l&apos;étape « Voix » : vos voix du Studio y apparaissent sous « Vos
        voix ».{" "}
        <Link href="/agents/new" className="text-brand-700 hover:underline">
          Créer un agent
        </Link>
      </Card>
    </div>
  );
}
