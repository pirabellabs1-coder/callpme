import { requireAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { AgencyRequestsAdmin } from "@/components/admin/agency-requests-admin";

export const metadata = { title: "Demandes Agence" };
export const dynamic = "force-dynamic";

export default async function AdminDemandesPage() {
  await requireAdmin();
  const rows = await prisma.agencyRequest.findMany({
    orderBy: { createdAt: "desc" },
    include: { organization: { select: { name: true } } },
    take: 100,
  });
  const requests = rows.map((r) => ({
    id: r.id,
    org: r.organization.name,
    contactName: r.contactName,
    contactEmail: r.contactEmail,
    objectives: r.objectives,
    budgetEur: r.budgetEur,
    status: r.status,
    quotedAmountEur: r.quotedAmountEur,
    createdAt: r.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-display-sm font-semibold tracking-tight text-foreground">
          Demandes — Offre Agence
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Validez les demandes et fixez le montant. Le client reçoit le montant
          par e-mail et règle depuis sa facturation.
        </p>
      </div>
      <AgencyRequestsAdmin requests={requests} />
    </div>
  );
}
