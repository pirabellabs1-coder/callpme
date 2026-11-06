import Link from "next/link";
import { ArrowRight, CalendarDays, PhoneIncoming, MessageSquare } from "lucide-react";
import { prisma } from "@/lib/db/client";
import { bookingConfig } from "@/lib/agenda/slots";
import { cn } from "@/lib/utils";

function agentTz(config: string | null | undefined): string {
  try {
    return bookingConfig(JSON.parse(config ?? "{}").booking).timezone;
  } catch {
    return bookingConfig().timezone;
  }
}

const when = (d: Date, tz: string) =>
  new Intl.DateTimeFormat("fr-FR", { timeZone: tz, weekday: "short", hour: "2-digit", minute: "2-digit" }).format(d);

function Column({
  title,
  icon: Icon,
  href,
  count,
  empty,
  children,
}: {
  title: string;
  icon: typeof CalendarDays;
  href: string;
  count: number;
  empty: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-label={title} className="flex min-w-0 flex-col p-5">
      <header className="flex items-center gap-2">
        <Icon className="size-4 text-muted-foreground" aria-hidden strokeWidth={1.75} />
        <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
        <span
          className={cn(
            "rounded-full px-1.5 text-xs font-semibold tabular-nums",
            count ? "bg-brand/15 text-brand" : "bg-foreground/[0.06] text-muted-foreground",
          )}
        >
          {count}
        </span>
        <Link href={href} className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
          Tout voir <ArrowRight className="size-3" aria-hidden />
        </Link>
      </header>
      {count === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground text-pretty">{empty}</p>
      ) : (
        <ul className="mt-3 space-y-1">{children}</ul>
      )}
    </section>
  );
}

/** « À traiter » : prochains rendez-vous, rappels promis, messages laissés. */
export async function TodayPanel({ orgId }: { orgId: string }) {
  const now = new Date();
  const [appointments, callbacks, messages, counts] = await Promise.all([
    prisma.appointment.findMany({
      where: { organizationId: orgId, isTest: false, status: "booked", startsAt: { gte: now } },
      orderBy: { startsAt: "asc" },
      take: 4,
      include: { agent: { select: { config: true } } },
    }),
    prisma.lead.findMany({
      where: { organizationId: orgId, isTest: false, kind: "callback", status: { in: ["new", "contacted"] } },
      orderBy: [{ callbackAt: "asc" }, { createdAt: "desc" }],
      take: 4,
      include: { agent: { select: { config: true } } },
    }),
    prisma.lead.findMany({
      where: { organizationId: orgId, isTest: false, kind: { in: ["message", "ticket"] }, status: "new" },
      orderBy: { createdAt: "desc" },
      take: 4,
    }),
    Promise.all([
      prisma.appointment.count({ where: { organizationId: orgId, isTest: false, status: "booked", startsAt: { gte: now } } }),
      prisma.lead.count({ where: { organizationId: orgId, isTest: false, kind: "callback", status: { in: ["new", "contacted"] } } }),
      prisma.lead.count({ where: { organizationId: orgId, isTest: false, kind: { in: ["message", "ticket"] }, status: "new" } }),
    ]),
  ]);
  const [nAppt, nCallback, nMsg] = counts;

  return (
    <div className="grid divide-y divide-border rounded-2xl border border-border bg-card md:grid-cols-3 md:divide-x md:divide-y-0">
      <Column title="Prochains rendez-vous" icon={CalendarDays} href="/appointments" count={nAppt} empty="Aucun rendez-vous à venir. Vos agents réservent ici dès qu'un appelant confirme un créneau.">
        {appointments.map((a) => (
          <li key={a.id} className="flex items-baseline gap-3 rounded-lg px-2 py-1.5 hover:bg-foreground/[0.03]">
            <span className="w-24 shrink-0 font-mono text-xs capitalize tabular-nums text-muted-foreground">{when(a.startsAt, agentTz(a.agent?.config))}</span>
            <span className="truncate text-sm">{a.customerName}</span>
          </li>
        ))}
      </Column>
      <Column title="À rappeler" icon={PhoneIncoming} href="/leads?kind=callback" count={nCallback} empty="Aucun rappel promis. Quand un appelant demande à être rappelé, il apparaît ici.">
        {callbacks.map((l) => (
          <li key={l.id} className="flex items-baseline gap-3 rounded-lg px-2 py-1.5 hover:bg-foreground/[0.03]">
            <span className="w-24 shrink-0 font-mono text-xs capitalize tabular-nums text-muted-foreground">
              {l.callbackAt ? when(l.callbackAt, agentTz(l.agent?.config)) : "Dès que possible"}
            </span>
            <span className="truncate text-sm">
              {l.name}
              {l.phone && <span className="ml-1.5 text-muted-foreground">{l.phone}</span>}
            </span>
          </li>
        ))}
      </Column>
      <Column title="Messages et tickets" icon={MessageSquare} href="/leads?kind=message" count={nMsg} empty="Aucun message en attente.">
        {messages.map((m) => (
          <li key={m.id} className="rounded-lg px-2 py-1.5 hover:bg-foreground/[0.03]">
            <p className="truncate text-sm">{m.name}</p>
            <p className="truncate text-xs text-muted-foreground">{m.notes ?? "—"}</p>
          </li>
        ))}
      </Column>
    </div>
  );
}
