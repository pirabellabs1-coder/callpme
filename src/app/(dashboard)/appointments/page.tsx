import Link from "next/link";
import { CalendarDays, CalendarCheck2, RefreshCcw } from "lucide-react";
import { requireSession } from "@/lib/auth/session";
import { listAppointments } from "@/lib/db/appointments";
import { listConnectedProviders } from "@/lib/db/integrations";
import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { CancelAppointmentButton } from "@/components/agenda/cancel-appointment-button";
import { SyncGoogleButton } from "@/components/agenda/sync-google-button";
import { cn } from "@/lib/utils";

export const metadata = { title: "Rendez-vous" };
export const dynamic = "force-dynamic";

const dayLabel = (iso: string, tz: string) =>
  new Intl.DateTimeFormat("fr-FR", { timeZone: tz, weekday: "long", day: "numeric", month: "long" }).format(new Date(iso));
const timeLabel = (iso: string, tz: string) =>
  new Intl.DateTimeFormat("fr-FR", { timeZone: tz, hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

export default async function AppointmentsPage({
  searchParams,
}: {
  searchParams: { view?: string; test?: string };
}) {
  const session = await requireSession();
  const view = searchParams.view === "past" ? "past" : "upcoming";
  const includeTest = searchParams.test === "1";
  const [rows, providers] = await Promise.all([
    listAppointments(session.org.id, { view, includeTest }),
    listConnectedProviders(session.org.id),
  ]);
  const googleOn = providers.includes("google_calendar");

  // Regroupement par jour (dans l'ordre déjà trié).
  const days: { label: string; items: typeof rows }[] = [];
  for (const r of rows) {
    const label = dayLabel(r.startsAt, r.timezone);
    const last = days[days.length - 1];
    if (last?.label === label) last.items.push(r);
    else days.push({ label, items: [r] });
  }

  const tab = (v: string, label: string) => (
    <Link
      href={`/appointments?view=${v}${includeTest ? "&test=1" : ""}`}
      aria-current={view === v ? "page" : undefined}
      className={cn(
        "rounded-md px-3 py-1.5 text-sm transition-colors",
        view === v ? "bg-secondary font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </Link>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rendez-vous"
        description="Les rendez-vous pris par vos agents pendant les appels, avec leur référence et leur statut."
      >
        {googleOn ? (
          <span className="inline-flex flex-wrap items-center gap-2">
            <Badge variant="success">
              <RefreshCcw aria-hidden="true" /> Google Agenda connecté
            </Badge>
            <SyncGoogleButton />
          </span>
        ) : (
          <Link href="/integrations" className="text-sm text-brand underline-offset-4 hover:underline">
            Connecter Google Agenda
          </Link>
        )}
      </PageHeader>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Période" className="flex gap-1 rounded-lg border border-border p-1">
          {tab("upcoming", "À venir")}
          {tab("past", "Passés")}
        </nav>
        <Link
          href={`/appointments?view=${view}${includeTest ? "" : "&test=1"}`}
          className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          {includeTest ? "Masquer les rendez-vous de test" : "Afficher les rendez-vous de test"}
        </Link>
      </div>

      {days.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title={view === "past" ? "Aucun rendez-vous passé" : "Aucun rendez-vous à venir"}
          description="Activez les outils « Vérifier les disponibilités » et « Prendre un rendez-vous » sur un agent : il réservera directement dans cet agenda."
        />
      ) : (
        <div className="space-y-6">
          {days.map((d) => (
            <section key={d.label} aria-labelledby={`day-${d.label}`}>
              <h2 id={`day-${d.label}`} className="mb-2 text-sm font-semibold capitalize text-foreground">
                {d.label}
              </h2>
              <Card className="divide-y divide-border">
                {d.items.map((a) => (
                  <div key={a.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4">
                    <div className="w-16 shrink-0 font-mono text-sm tabular-nums text-foreground">
                      {timeLabel(a.startsAt, a.timezone)}
                      <span className="block text-xs text-muted-foreground">{a.durationMin} min</span>
                      {a.timezone !== "Europe/Paris" && (
                        <span className="block text-[0.7rem] text-muted-foreground">{a.timezone.split("/")[1]?.replace("_", " ")}</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={cn("font-medium", a.status === "cancelled" && "text-muted-foreground line-through")}>
                        {a.customerName}
                      </p>
                      <p className="truncate text-sm text-muted-foreground">
                        {[a.customerPhone, a.customerEmail, a.notes].filter(Boolean).join(" · ") || "—"}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-mono text-muted-foreground">{a.reference}</span>
                      {a.agentName && <Badge variant="muted">{a.agentName}</Badge>}
                      {a.isTest && <Badge variant="warning">Test</Badge>}
                      {a.synced && (
                        <Badge variant="outline">
                          <CalendarCheck2 aria-hidden="true" /> Google
                        </Badge>
                      )}
                      {a.status === "cancelled" ? (
                        <Badge variant="danger">Annulé</Badge>
                      ) : (
                        view === "upcoming" && <CancelAppointmentButton id={a.id} label={`${a.customerName}, ${a.reference}`} />
                      )}
                    </div>
                  </div>
                ))}
              </Card>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
