import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { listPlatformVoices } from "@/lib/voices/platform";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card } from "@/components/ui/card";
import { SamplePlayButton } from "@/components/voices/sample-play-button";

export const metadata = { title: "Voix" };
export const dynamic = "force-dynamic";

const GENDER: Record<string, string> = { feminine: "Femme", masculine: "Homme", neutral: "Neutre" };
const GROUPS: { key: string; title: string }[] = [
  { key: "feminine", title: "Voix de femme" },
  { key: "masculine", title: "Voix d'homme" },
  { key: "other", title: "Autres voix" },
];

export default async function VoicesPage() {
  await requireSession();
  const voices = await listPlatformVoices({ activeOnly: true });
  const groupOf = (g: string | null) => (g === "feminine" || g === "masculine" ? g : "other");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Voix"
        description="Écoutez les voix disponibles pour vos agents. Ce sont de vraies voix : celle que vous entendez ici est celle qu'entendront vos appelants."
      />

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
                      <div className="min-w-0">
                        <p className="font-medium">{v.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {[v.gender ? GENDER[v.gender] : null, v.accent].filter(Boolean).join(" · ") || "Voix"}
                        </p>
                        {v.description && <p className="mt-1 text-sm text-muted-foreground">{v.description}</p>}
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
        Pour choisir la voix d&apos;un agent, ouvrez l&apos;agent puis l&apos;étape « Voix », ou{" "}
        <Link href="/agents/new" className="text-brand-700 hover:underline">
          créez un agent
        </Link>
        . Bientôt : un studio pour régler chaque voix (débit, émotion, prononciation) et créer vos propres voix.
      </Card>
    </div>
  );
}
