import { requireClientSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { Card } from "@/components/ui/card";
import { TwoFactorCard } from "@/components/settings/two-factor-card";

export const metadata = { title: "Sécurité" };
export const dynamic = "force-dynamic";

export default async function PortalSecurity() {
  const s = await requireClientSession();
  const u = await prisma.user.findUnique({ where: { id: s.user.id }, select: { twoFactorEnabled: true, twoFactorBackupCodes: true } });
  let remaining = 0;
  try {
    remaining = u?.twoFactorBackupCodes ? (JSON.parse(u.twoFactorBackupCodes) as string[]).length : 0;
  } catch {
    remaining = 0;
  }
  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Sécurité</h1>
      <Card className="space-y-3 p-5">
        <h2 className="text-sm font-semibold">Double authentification</h2>
        <p className="text-sm text-muted-foreground">
          Votre espace contient les conversations et les numéros de vos clients : protégez-le par un code en plus du mot de passe.
        </p>
        <TwoFactorCard enabled={Boolean(u?.twoFactorEnabled)} backupRemaining={remaining} />
      </Card>
    </div>
  );
}
