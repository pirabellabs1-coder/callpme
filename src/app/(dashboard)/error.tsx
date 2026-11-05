"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Erreur inattendue dans une page du tableau de bord : message clair + réessai. */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className="mx-auto flex max-w-md flex-col items-center py-24 text-center">
      <span className="inline-flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
        <AlertTriangle className="size-6" strokeWidth={1.5} aria-hidden />
      </span>
      <h1 className="mt-6 text-lg font-semibold tracking-tight text-foreground">Cette page n'a pas pu se charger</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Une erreur inattendue s'est produite. Réessayez dans un instant ; si le problème persiste, contactez le support
        {error.digest ? ` en indiquant la référence ${error.digest}` : ""}.
      </p>
      <Button onClick={reset} variant="outline" className="mt-8">
        <RotateCcw aria-hidden />
        Réessayer
      </Button>
    </div>
  );
}
