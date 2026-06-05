import Link from "next/link";
import { Building2, ArrowRight } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { listClients } from "@/lib/db/clients";
import { PageHeader } from "@/components/dashboard/page-header";
import { ClientsManager } from "@/components/clients/clients-manager";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata = { title: "Clients" };
export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const session = await requireSession();

  // Le multi-clients (espaces agence) est réservé à l'offre Agence.
  if (session.org.plan !== "agency") {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Clients"
          description="Gérez les sous-comptes de votre agence — chaque client a ses propres agents."
        />
        <Card className="mx-auto max-w-xl p-8 text-center">
          <span className="mx-auto inline-flex size-12 items-center justify-center rounded-2xl bg-brand/10 text-brand">
            <Building2 className="size-6" />
          </span>
          <h2 className="mt-4 text-lg font-semibold tracking-tight text-foreground">
            Réservé à l&apos;offre Agence
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            La gestion multi-clients (sous-comptes, marque blanche par client,
            espaces dédiés) est disponible avec l&apos;offre Agence. Passez à
            l&apos;offre Agence pour créer et piloter les espaces de vos clients.
          </p>
          <Link
            href="/billing"
            className={cn(buttonVariants({ variant: "brand" }), "mt-5 gap-1.5")}
          >
            Découvrir l&apos;offre Agence
            <ArrowRight className="size-4" />
          </Link>
        </Card>
      </div>
    );
  }

  const clients = await listClients(session.org.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clients"
        description="Gérez les sous-comptes de votre agence — chaque client a ses propres agents."
      />
      <ClientsManager initial={clients} />
    </div>
  );
}
