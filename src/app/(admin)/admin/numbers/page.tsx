import { prisma } from "@/lib/db/client";
import { requireAdmin } from "@/lib/auth/session";
import { NumberReviewActions } from "@/components/admin/number-review";

export const dynamic = "force-dynamic";
export const metadata = { title: "Numéros à vérifier" };

/**
 * Numéros déclarés par les clients (non achetés via Callpme) : à activer une
 * fois raccordés au compte opérateur de la plateforme, sinon à refuser.
 * Un numéro « en attente » ne reçoit aucun appel.
 */
export default async function AdminNumbersPage() {
  await requireAdmin();
  const pending = await prisma.phoneNumber.findMany({
    where: { status: "pending" },
    orderBy: { createdAt: "asc" },
    include: { organization: { select: { name: true } } },
    take: 200,
  });
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-display-sm font-semibold tracking-tight">Numéros à vérifier</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Activez un numéro seulement après avoir vérifié qu&apos;il appartient bien au client et qu&apos;il est raccordé au
          compte opérateur de la plateforme (appels entrants vers /api/telephony/inbound).
        </p>
      </div>
      {pending.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun numéro en attente.</p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {pending.map((n) => (
            <li key={n.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <span className="mono text-sm">{n.number}</span>
              <span className="flex-1 truncate text-sm text-muted-foreground">
                {n.organization.name} · {n.label} · déclaré le {n.createdAt.toLocaleDateString("fr-FR")}
              </span>
              <NumberReviewActions id={n.id} number={n.number} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
