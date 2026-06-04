import { Database } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

/** Affiché quand la base est vide (seed non exécuté). */
export function SeedNotice() {
  return (
    <EmptyState
      icon={Database}
      title="Base de données vide"
      description="Aucune organisation trouvée. Lancez le jeu de données de démonstration pour explorer la plateforme."
      action={
        <code className="rounded-md border border-border bg-muted px-3 py-1.5 font-mono text-sm text-foreground">
          npm run db:seed
        </code>
      }
    />
  );
}
