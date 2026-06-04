import { ShieldCheck } from "lucide-react";
import { listAllUsers } from "@/lib/db/admin";
import { getSession } from "@/lib/auth/session";
import { initials } from "@/lib/utils";
import { PageHeader } from "@/components/dashboard/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UserActions } from "@/components/admin/user-actions";

export const metadata = { title: "Utilisateurs" };
export const dynamic = "force-dynamic";

const fmt = new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" });

export default async function AdminUsersPage() {
  const [users, session] = await Promise.all([listAllUsers(), getSession()]);
  const selfId = session?.user.id;
  return (
    <div className="space-y-6">
      <PageHeader
        title="Utilisateurs"
        description={`${users.length} compte${users.length > 1 ? "s" : ""} sur la plateforme.`}
      />
      <Card className="overflow-hidden">
        <div className="divide-y divide-border">
          {users.map((u) => (
            <div key={u.id} className="flex items-center gap-3 px-5 py-3">
              <span className="inline-flex size-9 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-foreground/70 ring-1 ring-inset ring-border">
                {initials(u.name ?? u.email)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {u.name ?? "—"}
                </p>
                <p className="truncate text-xs text-muted-foreground">{u.email}</p>
              </div>
              <span className="hidden w-40 truncate text-sm text-muted-foreground md:block">
                {u.orgName}
              </span>
              {u.isAdmin && (
                <Badge variant="brand">
                  <ShieldCheck className="size-3" /> Admin
                </Badge>
              )}
              <Badge variant="muted">{u.role}</Badge>
              <span className="hidden w-28 text-right text-xs text-muted-foreground lg:block">
                {fmt.format(new Date(u.createdAt))}
              </span>
              <UserActions
                userId={u.id}
                isAdmin={u.isAdmin}
                isSelf={u.id === selfId}
              />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
