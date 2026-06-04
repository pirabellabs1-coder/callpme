import { requireAdmin } from "@/lib/auth/session";
import { AdminShell } from "@/components/admin/admin-shell";

export const dynamic = "force-dynamic";
export const metadata = { title: "Administration" };

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAdmin();
  return (
    <AdminShell
      userName={session.user.name ?? "Admin"}
      userEmail={session.user.email}
    >
      {children}
    </AdminShell>
  );
}
