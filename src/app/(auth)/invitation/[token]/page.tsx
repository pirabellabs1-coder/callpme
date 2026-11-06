import Link from "next/link";
import { findPendingInvitation } from "@/lib/team/invitations";
import { AcceptInvitationForm } from "@/components/auth/accept-invitation-form";

export const metadata = { title: "Invitation", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function InvitationPage({ params }: { params: { token: string } }) {
  const inv = await findPendingInvitation(params.token);
  if (!inv) {
    return (
      <div className="space-y-3">
        <h1 className="text-display-sm font-semibold tracking-tight">Invitation expirée</h1>
        <p className="text-sm text-muted-foreground">
          Ce lien n&apos;est plus valable : il a déjà servi ou a dépassé 7 jours. Demandez une nouvelle invitation à la
          personne qui vous l&apos;a envoyée.
        </p>
        <Link href="/login" className="inline-block text-sm font-medium text-brand hover:underline">
          Aller à la connexion
        </Link>
      </div>
    );
  }
  return (
    <AcceptInvitationForm
      token={params.token}
      email={inv.email}
      orgName={inv.organization.name}
      role={inv.role === "admin" ? "administrateur" : "membre"}
    />
  );
}
