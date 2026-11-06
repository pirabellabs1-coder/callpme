import { NextRequest } from "next/server";
import { getSession, isOrgAdmin } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { isRateLimited } from "@/lib/security/rate-limit";
import { badRequest, forbidden, notFound, ok, serverError, unauthorized } from "@/lib/api/respond";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_CLONED_VOICES = 10;

/**
 * POST /api/voices/:id/clone { consent: true } — clone la voix enregistrée au
 * Studio chez ElevenLabs (clonage instantané) pour l'utiliser au téléphone.
 * Le consentement de la personne enregistrée est exigé.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();
    if (!isOrgAdmin(session)) return forbidden("Réservé aux administrateurs de l'organisation.");
    const key = process.env.ELEVENLABS_API_KEY;
    if (!key) return badRequest("Le clonage de voix n'est pas encore activé sur la plateforme.");
    const body = await req.json().catch(() => null);
    if (body?.consent !== true) {
      return badRequest("Confirmez avoir l'accord de la personne dont c'est la voix.");
    }
    if (isRateLimited(`clone:${session.org.id}`, 5, 60 * 60_000)) {
      return badRequest("Trop de clonages en peu de temps. Réessayez plus tard.");
    }

    const voice = await prisma.voice.findFirst({ where: { id: params.id, organizationId: session.org.id } });
    if (!voice) return notFound("Voix introuvable");
    const m = /^data:(audio\/[a-z0-9.+-]+)(?:;[^,]*)?;base64,([A-Za-z0-9+/=]+)$/i.exec(voice.sampleUrl ?? "");
    if (!m) return badRequest("Enregistrez d'abord un échantillon de voix (30 secondes à 2 minutes, au calme).");
    const audio = Buffer.from(m[2], "base64");
    if (audio.length < 20_000) return badRequest("Échantillon trop court : enregistrez au moins 30 secondes.");
    const cloned = await prisma.voice.count({ where: { organizationId: session.org.id, provider: "elevenlabs" } });
    if (cloned >= MAX_CLONED_VOICES) return badRequest(`${MAX_CLONED_VOICES} voix clonées au maximum : supprimez-en une d'abord.`);

    const ext = m[1].split("/")[1].replace("mpeg", "mp3").replace(/[^a-z0-9]/g, "") || "webm";
    const form = new FormData();
    form.append("name", `${voice.name} · Callpme`.slice(0, 80));
    form.append("description", `Voix clonée depuis Callpme (organisation ${session.org.id}).`);
    form.append("remove_background_noise", "true");
    form.append("files", new Blob([audio], { type: m[1] }), `echantillon.${ext}`);
    const res = await fetch("https://api.elevenlabs.io/v1/voices/add", {
      method: "POST",
      headers: { "xi-api-key": key },
      body: form,
      signal: AbortSignal.timeout(50_000),
    });
    const data = (await res.json().catch(() => ({}))) as { voice_id?: string; detail?: { message?: string } | string };
    if (!res.ok || !data.voice_id) {
      console.error("[voices] clonage refusé :", res.status, typeof data.detail === "string" ? data.detail : data.detail?.message);
      return badRequest("Le clonage a échoué. Vérifiez la qualité de l'enregistrement (une seule voix, sans bruit) et réessayez.");
    }

    let settings: Record<string, unknown> = {};
    try {
      settings = voice.settings ? JSON.parse(voice.settings) : {};
    } catch {
      settings = {};
    }
    const updated = await prisma.voice.update({
      where: { id: voice.id },
      data: { provider: "elevenlabs", status: "ready", settings: JSON.stringify({ ...settings, externalVoiceId: data.voice_id, cloned: true }) },
    });
    return ok({ voice: { id: updated.id, provider: updated.provider } });
  } catch {
    return serverError("Impossible de cloner la voix.");
  }
}
