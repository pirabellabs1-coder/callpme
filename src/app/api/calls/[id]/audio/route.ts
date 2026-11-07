import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { getCallById } from "@/lib/db/calls";
import { notFound, serverError, unauthorized } from "@/lib/api/respond";
import { toE164 } from "@/lib/telephony/e164";
import { TWILIO_RECORDING_PREFIX, credsForNumber, fetchTwilioRecording } from "@/lib/telephony/twilio-accounts";

export const dynamic = "force-dynamic";

/**
 * GET /api/calls/:id/audio — enregistrement réel d'un appel téléphonique.
 * Le fichier reste chez l'opérateur (compte Twilio qui porte le numéro) ;
 * Callpme le relit avec ses identifiants, réservé à l'organisation de l'appel.
 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();
    const call = await getCallById(params.id, session.org.id);
    if (!call?.audioUrl?.startsWith(TWILIO_RECORDING_PREFIX)) return notFound("Enregistrement introuvable");
    const recordingSid = call.audioUrl.slice(TWILIO_RECORDING_PREFIX.length);
    // Numéro Callpme de l'appel : appelé (entrant) ou appelant (sortant).
    const own = toE164(call.direction === "outbound" ? call.fromNumber : call.toNumber);
    const creds = own ? await credsForNumber(own) : null;
    if (!creds) return notFound("Enregistrement indisponible : compte opérateur déconnecté.");
    const res = await fetchTwilioRecording(creds, recordingSid);
    if (!res || res.status === 404) return notFound("Enregistrement en cours de préparation : réessayez dans une minute.");
    if (!res.ok) return serverError("Lecture de l'enregistrement impossible.");
    const body = await res.arrayBuffer();
    return new Response(body, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": String(body.byteLength),
        "Cache-Control": "private, max-age=3600",
        "Content-Disposition": `inline; filename="appel-${call.id}.mp3"`,
      },
    });
  } catch {
    return serverError();
  }
}
