import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { cancelAppointment } from "@/lib/agenda/service";
import { ok, badRequest, notFound, unauthorized, serverError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

/** POST /api/appointments/:id/cancel — annule un rendez-vous de l'organisation. */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();
    const appt = await prisma.appointment.findFirst({
      where: { id: params.id, organizationId: session.org.id, source: { not: "block" } },
      select: { reference: true, status: true, isTest: true },
    });
    if (!appt) return notFound("Rendez-vous introuvable");
    if (appt.status !== "booked") return badRequest("Ce rendez-vous est déjà annulé.");
    const r = await cancelAppointment(session.org.id, { reference: appt.reference }, { test: appt.isTest, trusted: true });
    return r.ok ? ok({ success: true }) : badRequest(r.message);
  } catch {
    return serverError("Impossible d'annuler le rendez-vous");
  }
}
