import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { deleteVoice, updateVoice } from "@/lib/db/voices";
import { ok, badRequest, unauthorized, notFound, serverError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  name: z.string().min(1).max(60).optional(),
  gender: z.enum(["feminine", "masculine", "neutral"]).optional(),
  accent: z.string().max(40).optional(),
  description: z.string().max(300).optional(),
  sampleText: z.string().max(500).optional(),
  settings: z.string().max(2000).optional(),
  sampleUrl: z.string().max(6_000_000).optional(),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();
    const body = await req.json().catch(() => null);
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return badRequest("Données invalides");
    const voice = await updateVoice(session.org.id, params.id, parsed.data);
    return voice ? ok({ voice }) : notFound("Voix introuvable");
  } catch {
    return serverError();
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();
    const removed = await deleteVoice(session.org.id, params.id);
    return removed ? ok({ success: true }) : notFound("Voix introuvable");
  } catch {
    return serverError();
  }
}
