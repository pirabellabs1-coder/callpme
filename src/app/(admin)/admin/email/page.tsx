import { listAllUsers } from "@/lib/db/admin";
import { hasResend } from "@/lib/email/resend";
import { PageHeader } from "@/components/dashboard/page-header";
import { AdminEmail } from "@/components/admin/admin-email";

export const metadata = { title: "E-mails" };
export const dynamic = "force-dynamic";

export default async function AdminEmailPage() {
  const users = await listAllUsers();
  return (
    <div className="space-y-6">
      <PageHeader
        title="E-mails aux utilisateurs"
        description="Envoyez un message à un utilisateur ou à toute la plateforme (via Resend)."
      />
      <AdminEmail
        users={users.map((u) => ({ email: u.email, name: u.name }))}
        resendReady={hasResend()}
      />
    </div>
  );
}
