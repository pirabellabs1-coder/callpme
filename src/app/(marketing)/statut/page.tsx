import { CheckCircle2 } from "lucide-react";

export const metadata = { title: "Statut · Callpme" };

const SERVICES = [
  "API publique (/api/v1)",
  "Tableau de bord",
  "Création & test d'agents",
  "Appels & transcriptions",
  "Studio Voix",
  "Webhooks",
  "Authentification",
];

export default function StatutPage() {
  return (
    <div className="container-marketing py-14 sm:py-20">
      <div className="mx-auto max-w-3xl">
        <p className="font-mono text-sm font-semibold uppercase tracking-wider text-brand">
          Statut
        </p>
        <h1 className="mt-2 text-display-md font-semibold tracking-tight text-foreground">
          Statut des services
        </h1>

        <div className="mt-8 flex items-center gap-3 rounded-2xl border border-emerald-600/20 bg-emerald-50/60 px-5 py-4">
          <span className="relative flex size-3 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex size-3 rounded-full bg-emerald-500" />
          </span>
          <p className="text-sm font-semibold text-emerald-800">
            Tous les systèmes sont opérationnels.
          </p>
        </div>

        <div className="mt-6 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
          {SERVICES.map((s) => (
            <div key={s} className="flex items-center justify-between gap-4 px-5 py-3.5">
              <span className="text-sm text-foreground">{s}</span>
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600">
                <CheckCircle2 className="size-4" />
                Opérationnel
              </span>
            </div>
          ))}
        </div>

        <p className="mt-6 text-sm text-muted-foreground">
          Un incident à signaler ? Écrivez à{" "}
          <a href="mailto:contact@pirabellabs.com" className="font-medium text-brand hover:underline">
            contact@pirabellabs.com
          </a>.
        </p>
      </div>
    </div>
  );
}
