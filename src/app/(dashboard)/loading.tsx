import { Skeleton } from "@/components/ui/skeleton";

/** Écran de chargement commun à toutes les pages du tableau de bord. */
export default function DashboardLoading() {
  return (
    <div role="status" aria-label="Chargement de la page" className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-72 rounded-xl lg:col-span-2" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
      <span className="sr-only">Chargement…</span>
    </div>
  );
}
