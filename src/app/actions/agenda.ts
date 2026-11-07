"use server";

import { randomInt } from "crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession, isOrgAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { updateAgent } from "@/lib/db/agents";
import { bookingSchema } from "@/lib/validation/agent";
import { bookingConfig } from "@/lib/agenda/slots";
import { isYmd, normalizeHm, zonedToUtc } from "@/lib/agenda/time";
import { addDays } from "@/lib/agenda/calendar-dates";
import { Prisma } from "@prisma/client";

export interface AgendaResult {
  ok?: boolean;
  error?: string;
  /** Avertissement (ex. rendez-vous déjà pris pendant l'indisponibilité). */
  warning?: string;
}

async function adminAgent(agentId: string) {
  const session = await getSession();
  if (!session) return { error: "Session expirée : reconnectez-vous." } as const;
  if (!isOrgAdmin(session)) return { error: "Réservé aux administrateurs de l'organisation." } as const;
  const agent = await prisma.agent.findFirst({
    where: { id: String(agentId).slice(0, 40), organizationId: session.org.id },
    select: { id: true, organizationId: true, config: true },
  });
  if (!agent) return { error: "Agent introuvable." } as const;
  return { session, agent } as const;
}

/** Horaires de disponibilité d'un agent (jours, plages, durée, fuseau, délais). */
export async function saveBookingHours(agentId: string, booking: unknown): Promise<AgendaResult> {
  const ctx = await adminAgent(agentId);
  if ("error" in ctx) return { error: ctx.error };
  const parsed = bookingSchema.safeParse(bookingConfig((booking ?? null) as Parameters<typeof bookingConfig>[0]));
  if (!parsed.success) return { error: "Horaires invalides : vérifiez les plages (début avant la fin)." };
  await updateAgent(ctx.agent.id, { config: { booking: parsed.data } });
  revalidatePath("/appointments");
  return { ok: true };
}

const blockSchema = z.object({
  agentId: z.string().min(1).max(40),
  date: z.string().refine(isYmd, "Date invalide."),
  from: z.string().max(5),
  to: z.string().max(5),
  reason: z.string().trim().max(120).optional(),
});

/**
 * Indisponibilité (congé, réunion…) : un créneau bloqué dans l'agenda de
 * l'agent. L'agent ne le proposera plus aux appelants.
 */
export async function addUnavailability(input: unknown): Promise<AgendaResult> {
  const parsed = blockSchema.safeParse(input);
  if (!parsed.success) return { error: "Indiquez une date et des heures valides." };
  const ctx = await adminAgent(parsed.data.agentId);
  if ("error" in ctx) return { error: ctx.error };
  const from = normalizeHm(parsed.data.from);
  // « 24:00 » ou « 23:59 » = jusqu'à la fin de la journée.
  const endOfDay = parsed.data.to === "24:00" || parsed.data.to === "23:59";
  const to = endOfDay ? "24:00" : normalizeHm(parsed.data.to);
  if (!from || !to || to <= from) return { error: "L'heure de fin doit être après l'heure de début." };
  let cfg = bookingConfig();
  try {
    cfg = bookingConfig(JSON.parse(ctx.agent.config ?? "{}").booking);
  } catch {
    /* configuration par défaut */
  }
  const start = zonedToUtc(parsed.data.date, from, cfg.timezone);
  const end = endOfDay ? zonedToUtc(addDays(parsed.data.date, 1), "00:00", cfg.timezone) : zonedToUtc(parsed.data.date, to, cfg.timezone);
  const minutes = Math.round((end.getTime() - start.getTime()) / 60_000);
  if (minutes <= 0 || minutes > 24 * 60) return { error: "Plage horaire invalide." };
  const reference = `IND-${Array.from({ length: 5 }, () => "ABCDEFGHJKMNPQRSTUVWXYZ23456789"[randomInt(31)]).join("")}`;
  try {
    await prisma.appointment.create({
      data: {
        organizationId: ctx.agent.organizationId,
        agentId: ctx.agent.id,
        reference,
        customerName: "Indisponible",
        notes: parsed.data.reason || null,
        startsAt: start,
        durationMin: minutes,
        slotKey: `${ctx.agent.id}:block:${start.toISOString()}`,
        source: "block",
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: "Une indisponibilité commence déjà à cette heure." };
    }
    console.error("[agenda] indisponibilité impossible :", e instanceof Error ? e.message : e);
    return { error: "Enregistrement impossible pour le moment. Réessayez." };
  }
  revalidatePath("/appointments");
  // Rendez-vous déjà pris pendant cette indisponibilité : ils restent, on prévient.
  const overlapping = await prisma.appointment.count({
    where: {
      agentId: ctx.agent.id,
      status: "booked",
      isTest: false,
      source: { not: "block" },
      startsAt: { gte: new Date(start.getTime() - 24 * 3600_000), lt: end },
    },
  });
  return overlapping > 0
    ? { ok: true, warning: "Attention : des rendez-vous sont déjà pris autour de ce créneau. Vérifiez l'agenda et prévenez les clients concernés si besoin." }
    : { ok: true };
}

/** Retire une indisponibilité. */
export async function removeUnavailability(id: string): Promise<AgendaResult> {
  const session = await getSession();
  if (!session) return { error: "Session expirée : reconnectez-vous." };
  if (!isOrgAdmin(session)) return { error: "Réservé aux administrateurs de l'organisation." };
  const done = await prisma.appointment.updateMany({
    where: { id: String(id).slice(0, 40), organizationId: session.org.id, source: "block", status: "booked" },
    data: { status: "cancelled", slotKey: null },
  });
  if (done.count !== 1) return { error: "Indisponibilité introuvable." };
  revalidatePath("/appointments");
  return { ok: true };
}
