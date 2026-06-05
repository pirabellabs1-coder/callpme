import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { DocsPanel } from "@/components/dev/docs-panel";

export const metadata = { title: "Documentation API · Callpme" };

export default function DocumentationPage() {
  return (
    <div className="container-marketing py-14 sm:py-20">
      <div className="mx-auto max-w-4xl">
        <p className="font-mono text-sm font-semibold uppercase tracking-wider text-brand">
          Développeurs
        </p>
        <h1 className="mt-2 text-display-md font-semibold tracking-tight text-foreground text-balance">
          Documentation API
        </h1>
        <p className="mt-3 max-w-2xl text-lg text-muted-foreground text-pretty">
          L'API REST Callpme — créez des agents, lisez les appels et leurs
          transcripts, recevez des webhooks signés. Authentifiez-vous avec une
          clé générée dans votre espace Développeurs.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link href="/register" className={cn(buttonVariants({ variant: "brand" }), "gap-1.5")}>
            Obtenir une clé API
            <ArrowRight className="size-4" />
          </Link>
          <Link href="/developers" className={cn(buttonVariants({ variant: "outline" }))}>
            Espace Développeurs
          </Link>
        </div>

        <div className="mt-12">
          <DocsPanel apiBaseUrl="https://www.callpme.com" />
        </div>
      </div>
    </div>
  );
}
