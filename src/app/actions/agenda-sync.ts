"use server";

import { revalidatePath } from "next/cache";
import { getSession, isOrgAdmin } from "@/lib/auth/session";
import { isRateLimited } from "@/lib/security/rate-limit";
import { syncMissingGoogleEvents } from "@/lib/agenda/service";

/** Envoie vers Google Agenda les rendez-vous à venir qui n'y sont pas encore. */
export async function syncGoogleCalendar(): Promise<{ ok?: boolean; error?: string; info?: string }> {
  const session = await getSession();
  if (!session) return { error: "Session expirée : reconnectez-vous." };
  if (!isOrgAdmin(session)) return { error: "Réservé aux administrateurs de l'organisation." };
  if (isRateLimited(`gcalsync:${session.org.id}`, 10, 60 * 60_000)) return { error: "Trop de synchronisations. Réessayez plus tard." };
  const res = await syncMissingGoogleEvents(session.org.id);
  revalidatePath("/appointments");
  if (res.synced === 0 && res.failed === 0) return { ok: true, info: "Tout est déjà dans Google Agenda." };
  if (res.failed > 0 && res.synced === 0) {
    return { error: "Google Agenda refuse l'envoi : reconnectez Google Agenda dans Intégrations." };
  }
  return {
    ok: true,
    info: `${res.synced} rendez-vous envoyé(s) vers Google Agenda${res.failed ? `, ${res.failed} en échec` : ""}.`,
  };
}
