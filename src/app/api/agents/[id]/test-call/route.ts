import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { getAgentById } from "@/lib/db/agents";
import { createTestCall } from "@/lib/db/calls";
import { createNotification } from "@/lib/db/notifications";
import { evaluateCall } from "@/lib/evaluation/evaluate";
import { dispatchEvent } from "@/lib/webhooks/dispatch";
import type { TranscriptTurn } from "@/lib/shared/types";
import {
  created,
  badRequest,
  unauthorized,
  notFound,
  serverError,
} from "@/lib/api/respond";

export const dynamic = "force-dynamic";

const schema = z.object({
  transcript: z
    .array(
      z.object({
        speaker: z.enum(["agent", "caller", "system", "tool"]),
        text: z.string().max(4000),
        at: z.number(),
        toolName: z.string().optional(),
      }),
    )
    .max(300),
  durationSec: z.number().min(0).max(7200),
  // Enregistrement réel de l'appel (data URL audio), facultatif. ~12 Mo max.
  audio: z.string().max(12_000_000).startsWith("data:audio").optional(),
});

/** POST /api/agents/:id/test-call — enregistre la conversation de test. */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();
    const agent = await getAgentById(params.id);
    if (!agent || agent.organizationId !== session.org.id) {
      return notFound("Agent introuvable");
    }
    const body = await req.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest("Données invalides");

    const transcript = parsed.data.transcript as TranscriptTurn[];
    const callId = await createTestCall(agent.id, {
      transcript,
      durationSec: parsed.data.durationSec,
      audioUrl: parsed.data.audio ?? null,
    });

    // Évaluation automatique + notification
    const ev = evaluateCall(transcript, parsed.data.durationSec);
    await prisma.evaluation
      .create({
        data: {
          callId,
          successScore: ev.successScore,
          goalAchieved: ev.goalAchieved,
          sentiment: ev.sentiment,
          summary: ev.summary,
        },
      })
      .catch(() => {});
    await createNotification(session.org.id, {
      type: "call",
      title: `Appel de test — ${agent.name}`,
      body: `Score ${ev.successScore}/100 · ${ev.goalAchieved ? "objectif atteint" : "à améliorer"}`,
      href: `/calls/${callId}`,
    }).catch(() => {});

    // Émet l'événement webhook call.completed (signé) vers les endpoints abonnés.
    await dispatchEvent(session.org.id, "call.completed", {
      id: callId,
      agentId: agent.id,
      agentName: agent.name,
      durationSec: parsed.data.durationSec,
      successScore: ev.successScore,
      goalAchieved: ev.goalAchieved,
    }).catch(() => {});

    return created({ callId, evaluation: ev });
  } catch {
    return serverError();
  }
}
