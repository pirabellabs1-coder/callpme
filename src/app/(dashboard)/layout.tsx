import { DashboardShell } from "@/components/dashboard/shell";
import { requireSession } from "@/lib/auth/session";
import { listClients } from "@/lib/db/clients";
import { getActiveClientId } from "@/lib/db/active-client";

export const dynamic = "force-dynamic";

/** #RRGGBB → « H S% L% » pour surcharger la variable CSS --brand. */
function hexToHsl(hex: string): string | null {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return null;
  const int = parseInt(m[1], 16);
  const r = ((int >> 16) & 255) / 255;
  const g = ((int >> 8) & 255) / 255;
  const b = (int & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();
  // Le multi-clients (espaces agence) est réservé à l'offre Agence.
  const isAgency = session.org.plan === "agency";
  const [clients, activeClientId] = await Promise.all([
    isAgency ? listClients(session.org.id) : Promise.resolve([]),
    isAgency ? getActiveClientId(session.org.id) : Promise.resolve(null),
  ]);
  const active = clients.find((c) => c.id === activeClientId) ?? null;
  const activeClientColor =
    active && active.brandColor ? hexToHsl(active.brandColor) : null;

  return (
    <DashboardShell
      orgName={session.org.name}
      orgPlan={session.org.plan}
      userName={session.user.name ?? "Utilisateur"}
      userEmail={session.user.email}
      isAdmin={session.user.isAdmin}
      clients={clients.map((c) => ({
        id: c.id,
        name: c.name,
        brandColor: c.brandColor,
      }))}
      activeClientId={activeClientId}
      activeClientName={active?.name ?? null}
      activeClientColor={activeClientColor}
    >
      {children}
    </DashboardShell>
  );
}
