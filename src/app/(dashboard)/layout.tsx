import { DashboardShell } from "@/components/dashboard/shell";
import { requireSession } from "@/lib/auth/session";
import { listClients } from "@/lib/db/clients";
import { getActiveClientId } from "@/lib/db/active-client";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();
  const [clients, activeClientId] = await Promise.all([
    listClients(session.org.id),
    getActiveClientId(session.org.id),
  ]);

  return (
    <DashboardShell
      orgName={session.org.name}
      orgPlan={session.org.plan}
      userName={session.user.name ?? "Utilisateur"}
      userEmail={session.user.email}
      isAdmin={session.user.isAdmin}
      clients={clients.map((c) => ({ id: c.id, name: c.name }))}
      activeClientId={activeClientId}
    >
      {children}
    </DashboardShell>
  );
}
