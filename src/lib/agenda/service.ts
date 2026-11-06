/**
 * Agenda intégré : disponibilités, réservation, annulation.
 *
 * Callpme est la source de vérité (fonctionne sans aucune intégration). Si
 * Google Agenda est connecté, ses créneaux occupés sont pris en compte et
 * chaque rendez-vous y est créé / supprimé. La double réservation est
 * impossible : un verrou unique (`slotKey`) protège chaque créneau.
 */
import { randomInt } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../db/client";
import { dispatchEvent } from "../webhooks/dispatch";
import { createNotification } from "../db/notifications";
import { createGoogleEvent, deleteGoogleEvent, googleBusy } from "../integrations/google-calendar";
import { sendSms } from "../telephony/sms";
import { toE164 } from "../telephony/e164";
import type { Agent } from "../shared/types";
import { bookingConfig, freeSlots, withinOpeningHours, type BusyInterval, type PartOfDay } from "./slots";
import { isYmd, normalizeHm, spokenDateTime, utcToZoned, zonedToUtc } from "./time";

/** Plafonds anti-abus (un appelant ne peut pas vider l'agenda). */
const MAX_PER_CALL = 2;
const MAX_PER_PHONE = 3;

/** Lendemain d'une date « AAAA-MM-JJ » (calendrier, sans fuseau). */
function nextYmd(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

/** Effets externes en tâche de fond : une erreur est journalisée, jamais fatale. */
function background(label: string, fn: () => Promise<void>) {
  void fn().catch((e) => console.error(`[agenda] ${label} :`, e instanceof Error ? e.message : e));
}

const REF_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function newReference(): string {
  let s = "";
  for (let i = 0; i < 5; i++) s += REF_ALPHABET[randomInt(REF_ALPHABET.length)];
  return `RDV-${s}`;
}

/** Créneaux occupés de l'agent sur [from, to[ (Callpme + Google si connecté). */
async function busyBetween(agent: Agent, from: Date, to: Date, useGoogle: boolean): Promise<BusyInterval[]> {
  // useGoogle = réservation réelle : les rendez-vous de test ne bloquent pas les vrais créneaux.
  const [rows, google] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        agentId: agent.id,
        status: "booked",
        ...(useGoogle ? { isTest: false } : {}),
        startsAt: { lt: to, gte: new Date(from.getTime() - 24 * 3600_000) },
      },
      select: { startsAt: true, durationMin: true },
    }),
    useGoogle ? googleBusy(agent.organizationId, from, to) : Promise.resolve([]),
  ]);
  return [
    ...rows.map((r) => ({ start: r.startsAt, end: new Date(r.startsAt.getTime() + r.durationMin * 60_000) })),
    ...google,
  ];
}

export interface AvailabilityResult {
  ok: boolean;
  message: string;
  date?: string;
  slots?: string[];
  nextAvailable?: { date: string; slots: string[] } | null;
}

export async function checkAvailability(
  agent: Agent,
  args: { date?: unknown; partOfDay?: unknown },
  opts: { test?: boolean; now?: Date } = {},
): Promise<AvailabilityResult> {
  const cfg = bookingConfig(agent.config.booking);
  if (!isYmd(args.date)) return { ok: false, message: "Date invalide : format attendu AAAA-MM-JJ." };
  const now = opts.now ?? new Date();
  const part = (["matin", "apres-midi", "soir"] as const).includes(args.partOfDay as PartOfDay)
    ? (args.partOfDay as PartOfDay)
    : undefined;

  const dayFor = async (ymd: string) => {
    const from = zonedToUtc(ymd, "00:00", cfg.timezone);
    const to = zonedToUtc(nextYmd(ymd), "00:00", cfg.timezone);
    const busy = await busyBetween(agent, from, to, !opts.test);
    return freeSlots({ ymd, config: cfg, busy, now, partOfDay: part }).map((s) => s.hm);
  };

  const dayEnd = zonedToUtc(nextYmd(args.date), "00:00", cfg.timezone);
  if (dayEnd.getTime() <= now.getTime()) return { ok: false, message: `La date ${args.date} est déjà passée.` };
  if (zonedToUtc(args.date, "00:00", cfg.timezone).getTime() > now.getTime() + cfg.maxDaysAhead * 86_400_000) {
    return { ok: false, message: `Les rendez-vous sont possibles jusqu'à ${cfg.maxDaysAhead} jours à l'avance.` };
  }
  const slots = await dayFor(args.date);
  if (slots.length) {
    return { ok: true, message: `${slots.length} créneau(x) libre(s) le ${args.date}.`, date: args.date, slots: slots.slice(0, 8) };
  }
  // Rien ce jour-là : propose le prochain jour disponible (7 jours max).
  const base = zonedToUtc(args.date, "12:00", cfg.timezone);
  for (let i = 1; i <= 7; i++) {
    const ymd = utcToZoned(new Date(base.getTime() + i * 86_400_000), cfg.timezone).ymd;
    const next = await dayFor(ymd);
    if (next.length) {
      return {
        ok: true,
        message: `Aucun créneau le ${args.date}. Prochain jour disponible : ${ymd}.`,
        date: args.date,
        slots: [],
        nextAvailable: { date: ymd, slots: next.slice(0, 6) },
      };
    }
  }
  return { ok: true, message: `Aucun créneau disponible le ${args.date} ni dans les 7 jours suivants.`, slots: [], nextAvailable: null };
}

export interface BookInput {
  name?: unknown;
  date?: unknown;
  time?: unknown;
  phone?: unknown;
  email?: unknown;
  notes?: unknown;
}

export interface BookResult {
  ok: boolean;
  message: string;
  reference?: string;
  appointmentId?: string;
  alternatives?: string[];
}

export async function bookAppointment(
  agent: Agent,
  input: BookInput,
  ctx: { callerNumber?: string; callRef?: string; test?: boolean; source?: "call" | "dashboard" | "api"; now?: Date },
): Promise<BookResult> {
  const cfg = bookingConfig(agent.config.booking);
  const name = typeof input.name === "string" ? input.name.trim().slice(0, 120) : "";
  const hm = normalizeHm(input.time);
  if (!name) return { ok: false, message: "Nom du client manquant." };
  if (!isYmd(input.date) || !hm) return { ok: false, message: "Date ou heure invalide (AAAA-MM-JJ et HH:MM)." };
  const ymd = input.date;
  const now = ctx.now ?? new Date();
  const start = zonedToUtc(ymd, hm, cfg.timezone);
  const end = new Date(start.getTime() + cfg.durationMin * 60_000);

  const alternatives = async () => {
    const busy = await busyBetween(agent, zonedToUtc(ymd, "00:00", cfg.timezone), new Date(start.getTime() + 24 * 3600_000), !ctx.test);
    return freeSlots({ ymd, config: cfg, busy, now }).map((s) => s.hm).slice(0, 5);
  };

  const onGrid = freeSlots({ ymd, config: { ...cfg, minNoticeMin: 0, maxDaysAhead: 100_000 }, busy: [], now: new Date(0) }).some((s) => s.hm === hm);
  if (!withinOpeningHours(ymd, hm, cfg) || !onGrid) {
    return { ok: false, message: `Ce créneau est en dehors des horaires d'ouverture.`, alternatives: await alternatives() };
  }
  if (start.getTime() < now.getTime() + cfg.minNoticeMin * 60_000) {
    return { ok: false, message: "Ce créneau est trop proche ou déjà passé.", alternatives: await alternatives() };
  }
  if (start.getTime() > now.getTime() + cfg.maxDaysAhead * 86_400_000) {
    return { ok: false, message: `Les rendez-vous sont possibles jusqu'à ${cfg.maxDaysAhead} jours à l'avance.` };
  }
  const busy = await busyBetween(agent, start, end, !ctx.test);
  if (busy.some((b) => start < b.end && b.start < end)) {
    return { ok: false, message: "Ce créneau vient d'être pris.", alternatives: await alternatives() };
  }

  const phoneRaw = typeof input.phone === "string" && input.phone.trim() ? input.phone : ctx.callerNumber;
  const phone = phoneRaw ? toE164(phoneRaw) : null;
  const caller = ctx.callerNumber ? toE164(ctx.callerNumber) : null;
  // Anti-saturation : un même appel ou un même numéro ne bloque pas tout l'agenda.
  const [byCall, byPhone] = await Promise.all([
    ctx.callRef
      ? prisma.appointment.count({ where: { organizationId: agent.organizationId, callRef: ctx.callRef, status: "booked" } })
      : Promise.resolve(0),
    phone
      ? prisma.appointment.count({
          where: { organizationId: agent.organizationId, customerPhone: phone, status: "booked", startsAt: { gte: now }, isTest: Boolean(ctx.test) },
        })
      : Promise.resolve(0),
  ]);
  if (byCall >= MAX_PER_CALL || byPhone >= MAX_PER_PHONE) {
    return { ok: false, message: "Nombre maximal de rendez-vous atteint pour ce client : propose d'annuler ou de déplacer un rendez-vous existant." };
  }
  const email =
    typeof input.email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())
      ? input.email.trim().toLowerCase().slice(0, 200)
      : null;
  const notes = typeof input.notes === "string" ? input.notes.trim().slice(0, 1000) || null : null;

  let appt;
  for (let attempt = 0; attempt < 3 && !appt; attempt++) {
    try {
      appt = await prisma.appointment.create({
        data: {
          organizationId: agent.organizationId,
          agentId: agent.id,
          reference: newReference(),
          customerName: name,
          customerPhone: phone,
          customerEmail: email,
          notes,
          startsAt: start,
          durationMin: cfg.durationMin,
          slotKey: `${ctx.test ? "test:" : ""}${agent.id}:${start.toISOString()}`,
          isTest: Boolean(ctx.test),
          source: ctx.source ?? "call",
          callRef: ctx.callRef ?? null,
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        const target = String((e.meta as { target?: unknown })?.target ?? "");
        // Créneau pris entre-temps (réservation simultanée) : on s'arrête.
        if (target.includes("slotKey")) {
          return { ok: false, message: "Ce créneau vient d'être pris.", alternatives: await alternatives() };
        }
        continue; // collision de référence : nouvel essai
      }
      throw e;
    }
  }
  if (!appt) return { ok: false, message: "Réservation impossible pour le moment." };

  const when = spokenDateTime(start, cfg.timezone);
  if (!ctx.test) {
    background("effets de réservation", async () => {
      const eventId = await createGoogleEvent(agent.organizationId, {
        summary: `RDV ${name}`,
        description: [`Référence : ${appt.reference}`, phone && `Téléphone : ${phone}`, email && `E-mail : ${email}`, notes]
          .filter(Boolean)
          .join("\n"),
        start,
        end,
        timezone: cfg.timezone,
      });
      if (eventId) await prisma.appointment.update({ where: { id: appt.id }, data: { googleEventId: eventId } }).catch(() => {});
      // SMS seulement au numéro réellement appelant (jamais à un numéro dicté).
      if (cfg.smsConfirmation && phone && caller && phone === caller) {
        const org = await prisma.organization.findUnique({ where: { id: agent.organizationId }, select: { name: true } });
        await sendSms(
          phone,
          `${org?.name ?? "Votre rendez-vous"} : rendez-vous confirmé le ${when}. Réf. ${appt.reference}. Pour annuler, rappelez-nous en indiquant cette référence.`,
          { callId: ctx.callRef, organizationId: agent.organizationId },
        );
      }
      await createNotification(agent.organizationId, {
        type: "call",
        title: `Rendez-vous pris : ${name}`,
        body: `${when} — ${agent.name}`,
        href: "/appointments",
      }).catch(() => {});
      await dispatchEvent(agent.organizationId, "appointment.booked", {
        id: appt.id,
        reference: appt.reference,
        agentId: agent.id,
        customerName: name,
        customerPhone: phone,
        customerEmail: email,
        startsAt: start.toISOString(),
        durationMin: cfg.durationMin,
        notes,
      }).catch(() => {});
    });
  }

  return {
    ok: true,
    message: `Rendez-vous confirmé pour ${name} le ${when}. Référence ${appt.reference}.`,
    reference: appt.reference,
    appointmentId: appt.id,
  };
}

const cancelAttempts = new Map<string, number>();

function sameName(a: string, b: string): boolean {
  const norm = (s: string) =>
    s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z]/g, " ").split(/\s+/).filter(Boolean);
  const x = norm(a);
  const y = new Set(norm(b));
  return x.length > 0 && x.some((w) => w.length > 1 && y.has(w));
}

/**
 * Annulation depuis un appel : par référence (avec le nom ou le numéro du
 * titulaire) ou, sans référence, le prochain rendez-vous du numéro appelant.
 * `trusted` = action du tableau de bord (utilisateur authentifié).
 */
export async function cancelAppointment(
  orgId: string,
  input: { reference?: unknown; phone?: unknown; name?: unknown },
  ctx: { callerNumber?: string; test?: boolean; now?: Date; callRef?: string; trusted?: boolean },
): Promise<{ ok: boolean; message: string; reference?: string }> {
  const now = ctx.now ?? new Date();
  const ref = typeof input.reference === "string" ? input.reference.trim().toUpperCase() : "";
  // Seul le numéro réel de l'appelant identifie le titulaire (pas un numéro dicté).
  const phone = ctx.callerNumber ? toE164(ctx.callerNumber) : null;
  if (!ctx.trusted && ctx.callRef) {
    const n = (cancelAttempts.get(ctx.callRef) ?? 0) + 1;
    cancelAttempts.set(ctx.callRef, n);
    if (cancelAttempts.size > 5000) cancelAttempts.clear();
    if (n > 3) return { ok: false, message: "Trop de tentatives d'annulation : propose de transmettre la demande à l'équipe." };
  }

  // Par référence, sinon par numéro de l'appelant (son prochain rendez-vous).
  const appt = ref
    ? await prisma.appointment.findFirst({ where: { organizationId: orgId, reference: ref, status: "booked", isTest: Boolean(ctx.test) } })
    : phone
      ? await prisma.appointment.findFirst({
          where: { organizationId: orgId, customerPhone: phone, status: "booked", startsAt: { gte: now }, isTest: Boolean(ctx.test) },
          orderBy: { startsAt: "asc" },
        })
      : null;
  if (!appt) {
    return { ok: false, message: "Aucun rendez-vous à venir trouvé. Demandez la référence (RDV-…) donnée à la réservation." };
  }
  // Sans référence, le rendez-vous doit appartenir au numéro de l'appelant.
  if (!ref && appt.customerPhone !== phone) return { ok: false, message: "Rendez-vous introuvable pour ce numéro." };
  // Avec une référence : il faut aussi le numéro du titulaire ou son nom.
  if (ref && !ctx.trusted) {
    const owner = (phone && appt.customerPhone === phone) || (typeof input.name === "string" && sameName(input.name, appt.customerName));
    if (!owner) return { ok: false, message: "Pour annuler, demande le nom sous lequel le rendez-vous a été pris." };
  }

  if (!ctx.trusted && appt.startsAt.getTime() < now.getTime()) {
    return { ok: false, message: "Ce rendez-vous est déjà passé." };
  }
  // Atomique : deux annulations simultanées ne déclenchent qu'une fois les effets.
  const done = await prisma.appointment.updateMany({ where: { id: appt.id, status: "booked" }, data: { status: "cancelled", slotKey: null } });
  if (done.count !== 1) return { ok: false, message: "Ce rendez-vous est déjà annulé." };
  if (!appt.isTest) {
    background("effets d'annulation", async () => {
      if (appt.googleEventId) await deleteGoogleEvent(orgId, appt.googleEventId);
      await dispatchEvent(orgId, "appointment.cancelled", {
        id: appt.id,
        reference: appt.reference,
        customerName: appt.customerName,
        startsAt: appt.startsAt.toISOString(),
      }).catch(() => {});
      await createNotification(orgId, {
        type: "call",
        title: `Rendez-vous annulé : ${appt.customerName}`,
        body: appt.reference,
        href: "/appointments",
      }).catch(() => {});
    });
  }
  return { ok: true, message: `Rendez-vous ${appt.reference} annulé.`, reference: appt.reference };
}
