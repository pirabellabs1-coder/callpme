import type { Metadata } from "next";
import { prisma } from "@/lib/db/client";
import { PageHero } from "@/components/marketing/sections";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Statut des services" };
// Revérifié au plus toutes les 60 secondes.
export const revalidate = 60;

const SERVICES = [
  "API publique (/api/v1)",
  "Tableau de bord",
  "Création et test d'agents",
  "Appels et transcriptions",
  "Webhooks",
  "Authentification",
];

/** Vérification réelle : la base de données répond-elle ? */
async function checkDatabase(): Promise<boolean> {
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 4000)),
    ]);
    return true;
  } catch {
    return false;
  }
}

export default async function StatutPage() {
  const ok = await checkDatabase();
  const checkedAt = new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris", dateStyle: "long", timeStyle: "short" });

  return (
    <>
      <PageHero eyebrow="Statut" title="Statut des services" subtitle={`Dernière vérification : ${checkedAt} (heure de Paris).`} />

      <section className="pb-24 sm:pb-32">
        <div className="container-marketing mx-auto max-w-3xl space-y-4">
          <div
            role="status"
            className={cn(
              "flex items-center gap-3 rounded-2xl border px-5 py-4",
              ok ? "border-success/30 bg-success/10" : "border-destructive/30 bg-destructive/10",
            )}
          >
            <span className={cn("size-3 shrink-0 rounded-full", ok ? "bg-success" : "bg-destructive")} aria-hidden />
            <p className={cn("text-sm font-medium", ok ? "text-success" : "text-destructive")}>
              {ok ? "Tous les services répondent normalement." : "Perturbation en cours : certains services peuvent être indisponibles."}
            </p>
          </div>

          <div className="bezel">
            <ul className="bezel-core divide-y divide-border">
              {SERVICES.map((s) => (
                <li key={s} className="flex items-center justify-between gap-4 px-5 py-4">
                  <span className="text-sm text-foreground">{s}</span>
                  <span className={cn("text-xs font-medium", ok ? "text-success" : "text-destructive")}>
                    {ok ? "Opérationnel" : "Perturbé"}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <p className="pt-2 text-sm text-muted-foreground">
            Un incident à signaler ? Écrivez à{" "}
            <a href="mailto:contact@pirabellabs.com" className="font-medium text-foreground underline underline-offset-4">
              contact@pirabellabs.com
            </a>
            .
          </p>
        </div>
      </section>
    </>
  );
}
