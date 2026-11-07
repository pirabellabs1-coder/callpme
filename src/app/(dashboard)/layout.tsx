import { DashboardShell } from "@/components/dashboard/shell";
import { requireSession } from "@/lib/auth/session";
import { listClients } from "@/lib/db/clients";
import { getActiveClientId } from "@/lib/db/active-client";
import { prisma } from "@/lib/db/client";
import { minutesUsedSince, orgSubscription } from "@/lib/billing/limits";
import { getPlan } from "@/lib/billing/plans";
import { telephonyConfigured, telephonyProvider, voiceEngineMissing } from "@/lib/telephony/provider";

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
  const orgId = session.org.id;
  const now = new Date();
  const sub = await orgSubscription(orgId, now);
  const [clients, activeClientId, pendingLeads, upcomingAppointments, minutesUsed] = await Promise.all([
    isAgency ? listClients(orgId) : Promise.resolve([]),
    isAgency ? getActiveClientId(orgId) : Promise.resolve(null),
    prisma.lead.count({ where: { organizationId: orgId, isTest: false, status: "new" } }),
    prisma.appointment.count({
      where: {
        organizationId: orgId,
        isTest: false,
        status: "booked",
        source: { not: "block" },
        startsAt: { gte: now, lt: new Date(now.getTime() + 24 * 3600_000) },
      },
    }),
    minutesUsedSince(orgId, sub.periodStart),
  ]);
  const missing = [...voiceEngineMissing(), ...(telephonyProvider() ? [] : ["opérateur (Twilio ou Telnyx)"])];
  const active = clients.find((c) => c.id === activeClientId) ?? null;
  const activeClientColor =
    active && active.brandColor ? hexToHsl(active.brandColor) : null;

  return (
    <DashboardShell
      orgName={session.org.name}
      orgPlan={session.org.plan}
      userName={session.user.name ?? "Utilisateur"}
      userEmail={session.user.email}
      clients={clients.map((c) => ({
        id: c.id,
        name: c.name,
        brandColor: c.brandColor,
      }))}
      activeClientId={activeClientId}
      activeClientName={active?.name ?? null}
      activeClientColor={activeClientColor}
      badges={{ "/leads": pendingLeads, "/appointments": upcomingAppointments }}
      usage={{ used: minutesUsed, total: sub.minutesIncluded }}
      status={
        sub.status === "expired"
          ? sub.neverPaid
            ? { tone: "warn", label: "Choisir une offre pour activer les appels", href: "/billing" }
            : { tone: "danger", label: "Abonnement expiré : renouveler", href: "/billing" }
          : !telephonyConfigured()
            ? {
                tone: "warn",
                label: "Appels téléphoniques bientôt disponibles",
                href: "/numbers",
                // Les noms de variables ne parlent qu'à l'équipe Callpme.
                detail: session.user.isAdmin
                  ? `Manque : ${missing.join(", ")}`
                  : "Testez vos agents au micro et sur votre site ; les appels téléphoniques arrivent bientôt.",
              }
            : sub.status === "trial"
              ? { tone: "warn", label: `Accès démo : ${sub.daysLeft} jour${sub.daysLeft > 1 ? "s" : ""}`, href: "/billing" }
              : { tone: "ok", label: "Appels actifs", href: "/calls" }
      }
    >
      {children}
    </DashboardShell>
  );
}
