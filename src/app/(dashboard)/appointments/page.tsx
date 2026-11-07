import Link from "next/link";
import { CalendarDays, CalendarCheck2, RefreshCcw } from "lucide-react";
import { requireSession, isOrgAdmin } from "@/lib/auth/session";
import { listAppointments } from "@/lib/db/appointments";
import { listConnectedProviders } from "@/lib/db/integrations";
import { PageHeader } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { CancelAppointmentButton } from "@/components/agenda/cancel-appointment-button";
import { SyncGoogleButton } from "@/components/agenda/sync-google-button";
import { AgendaCalendar, type CalendarEvent } from "@/components/agenda/agenda-calendar";
import { AgendaSettings, type AgendaAgent } from "@/components/agenda/agenda-settings";
import { RemoveBlockButton } from "@/components/agenda/remove-block-button";
import { prisma } from "@/lib/db/client";
import { listAppointmentsBetween } from "@/lib/db/appointments";
import { bookingConfig } from "@/lib/agenda/slots";
import { isYmd, utcToZoned } from "@/lib/agenda/time";
import { addDays, mondayOf } from "@/lib/agenda/calendar-dates";
import type { AgentConfig } from "@/lib/shared/types";
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
  searchParams: { view?: string; test?: string; mode?: string; date?: string };
}) {
  const session = await requireSession();
  const mode = (["semaine", "mois", "liste", "horaires"] as const).find((m) => m === searchParams.mode) ?? "semaine";

  // Agents qui prennent des rendez-vous : leurs horaires (réglables ici) et le fuseau d'affichage.
  const agentRows = await prisma.agent.findMany({
    where: { organizationId: session.org.id },
    select: { id: true, name: true, config: true },
    orderBy: { createdAt: "asc" },
  });
  const bookingAgents: AgendaAgent[] = agentRows
    .map((a) => {
      let cfg: Partial<AgentConfig> = {};
      try {
        cfg = JSON.parse(a.config ?? "{}");
      } catch {
        cfg = {};
      }
      const tools = (cfg as { tools?: string[] }).tools ?? [];
      return tools.includes("bookAppointment") || tools.includes("checkAvailability")
        ? { id: a.id, name: a.name, booking: cfg.booking ?? null }
        : null;
    })
    .filter((a): a is AgendaAgent => a !== null);
  const displayCfg = bookingConfig(bookingAgents[0]?.booking ?? null);
  const today = utcToZoned(new Date(), displayCfg.timezone).ymd;
  const anchor = searchParams.date && isYmd(searchParams.date) ? searchParams.date : today;
  const rangeStart = mode === "mois" ? addDays(mondayOf(`${anchor.slice(0, 7)}-01`), -1) : addDays(mondayOf(anchor), -1);
  const rangeEnd = addDays(rangeStart, mode === "mois" ? 44 : 9);
  const [calendarRows, blockRows] = await Promise.all([
    mode === "semaine" || mode === "mois"
      ? listAppointmentsBetween(session.org.id, new Date(`${rangeStart}T00:00:00Z`), new Date(`${rangeEnd}T00:00:00Z`))
      : Promise.resolve([]),
    mode === "horaires"
      ? prisma.appointment.findMany({
          where: { organizationId: session.org.id, source: "block", status: "booked", startsAt: { gte: new Date(Date.now() - 86_400_000) } },
          orderBy: { startsAt: "asc" },
          take: 50,
          include: { agent: { select: { name: true, config: true } } },
        })
      : Promise.resolve([]),
  ]);
  const events: CalendarEvent[] = calendarRows.map((r) => ({
    id: r.id,
    title: r.customerName,
    reference: r.reference,
    startsAt: r.startsAt,
    durationMin: r.durationMin,
    agentName: r.agentName,
    notes: r.notes,
    phone: r.customerPhone,
    synced: r.synced,
    block: r.source === "block",
    timezone: r.timezone,
    callId: r.callId ?? null,
    summary: r.callSummary ?? null,
  }));
  const blocks = blockRows.map((b) => {
    let tz = displayCfg.timezone;
    try {
      tz = bookingConfig(JSON.parse(b.agent?.config ?? "{}").booking).timezone;
    } catch {
      /* fuseau par défaut */
    }
    const startZ = utcToZoned(b.startsAt, tz);
    const endZ = utcToZoned(new Date(b.startsAt.getTime() + b.durationMin * 60_000), tz);
    return {
      id: b.id,
      agentName: b.agent?.name ?? null,
      label: `${new Date(`${startZ.ymd}T12:00:00Z`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })}, ${startZ.hm}–${endZ.hm}`,
      reason: b.notes,
    };
  });
  const modeTab = (m: typeof mode, label: string) => (
    <Link
      key={m}
      href={`/appointments?mode=${m}${m === "semaine" || m === "mois" ? `&date=${anchor}` : ""}`}
      aria-current={mode === m ? "page" : undefined}
      className={cn(
        "rounded-md px-3 py-1.5 text-sm transition-colors",
        mode === m ? "bg-secondary font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </Link>
  );
  const view = searchParams.view === "past" ? "past" : "upcoming";
  const includeTest = searchParams.test === "1";
  const [rows, providers] = await Promise.all([
    mode === "liste" ? listAppointments(session.org.id, { view, includeTest }) : Promise.resolve([]),
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
      href={`/appointments?mode=liste&view=${v}${includeTest ? "&test=1" : ""}`}
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

      <nav aria-label="Affichage" className="flex w-fit flex-wrap gap-1 rounded-lg border border-border p-1">
        {modeTab("semaine", "Semaine")}
        {modeTab("mois", "Mois")}
        {modeTab("liste", "Liste")}
        {modeTab("horaires", "Horaires et indisponibilités")}
      </nav>

      {(mode === "semaine" || mode === "mois") && (
        <AgendaCalendar mode={mode} anchor={anchor} today={today} events={events} openHours={displayCfg.hours} canEdit={isOrgAdmin(session)} />
      )}

      {mode === "horaires" && <AgendaSettings agents={bookingAgents} blocks={blocks} canEdit={isOrgAdmin(session)} />}

      {mode === "liste" && (
      <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Période" className="flex gap-1 rounded-lg border border-border p-1">
          {tab("upcoming", "À venir")}
          {tab("past", "Passés")}
        </nav>
        <Link
          href={`/appointments?mode=liste&view=${view}${includeTest ? "" : "&test=1"}`}
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
                      {a.source === "block" && <Badge variant="muted">Indisponibilité</Badge>}
                      {a.status === "cancelled" ? (
                        <Badge variant="danger">Annulé</Badge>
                      ) : a.source === "block" ? (
                        view === "upcoming" && isOrgAdmin(session) && <RemoveBlockButton id={a.id} />
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
      </>
      )}
    </div>
  );
}
