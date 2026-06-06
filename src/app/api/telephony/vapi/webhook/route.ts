import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import type { TranscriptTurn } from "@/lib/shared/types";

export const dynamic = "force-dynamic";

/** Mappe les messages Vapi en tours de transcript Callpme. */
function toTurns(messages: unknown): TranscriptTurn[] {
  if (!Array.isArray(messages)) return [];
  const turns: TranscriptTurn[] = [];
  for (const m of messages) {
    const role = String((m as { role?: string }).role ?? "");
    const text = String(
      (m as { message?: string }).message ?? (m as { content?: string }).content ?? "",
    ).trim();
    if (!text) continue;
    if (role === "system") continue;
    const at = Math.round(Number((m as { secondsFromStart?: number }).secondsFromStart ?? 0));
    turns.push({
      speaker: role === "user" ? "caller" : "agent",
      text,
      at: isFinite(at) ? at : 0,
    });
  }
  return turns;
}

/**
 * POST /api/telephony/vapi/webhook — reçoit les événements Vapi.
 * On enregistre le compte-rendu de fin d'appel (transcript + enregistrement)
 * comme un appel Callpme rattaché à l'agent (via metadata.agentId).
 */
export async function POST(req: NextRequest) {
  try {
    const secret = process.env.VAPI_WEBHOOK_SECRET;
    if (secret && req.headers.get("x-vapi-secret") !== secret) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }
    const body = await req.json().catch(() => null);
    const msg = body?.message;
    if (!msg || msg.type !== "end-of-call-report") {
      return NextResponse.json({ ok: true });
    }

    const call = msg.call ?? {};
    const agentId = call?.metadata?.agentId as string | undefined;
    if (!agentId) return NextResponse.json({ ok: true });
    const agent = await prisma.agent.findUnique({ where: { id: agentId }, select: { id: true } });
    if (!agent) return NextResponse.json({ ok: true });

    const artifact = msg.artifact ?? {};
    const analysis = msg.analysis ?? {};
    const turns = toTurns(artifact.messages);
    if (turns.length === 0 && typeof artifact.transcript === "string" && artifact.transcript.trim()) {
      turns.push({ speaker: "agent", text: artifact.transcript.trim(), at: 0 });
    }
    const durationSec = Math.round(
      Number(msg.durationSeconds ?? msg.durationSec ?? 0) ||
        (msg.startedAt && msg.endedAt
          ? (new Date(msg.endedAt).getTime() - new Date(msg.startedAt).getTime()) / 1000
          : 0),
    );
    const toNumber = call?.customer?.number ?? "—";
    const isInbound = call?.type === "inboundPhoneCall";
    const outcome =
      (typeof analysis.summary === "string" && analysis.summary.trim()) ||
      (typeof msg.endedReason === "string" ? msg.endedReason : "Appel réel");

    await prisma.call.create({
      data: {
        agentId,
        direction: isInbound ? "inbound" : "outbound",
        fromNumber: isInbound ? toNumber : "Agent Callpme",
        toNumber: isInbound ? "Agent Callpme" : toNumber,
        status: "completed",
        durationSec: isFinite(durationSec) ? durationSec : 0,
        transcript: JSON.stringify(turns),
        audioUrl: typeof artifact.recordingUrl === "string" ? artifact.recordingUrl : null,
        summary: typeof analysis.summary === "string" ? analysis.summary : "Appel téléphonique réel.",
        outcome,
      },
    });

    /* ------------------- Mise à jour campagne / contact ------------------- */
    const contactId = call?.metadata?.contactId as string | undefined;
    const campaignId = call?.metadata?.campaignId as string | undefined;
    const vapiCallId = call?.id as string | undefined;

    // Bascule du contact (par contactId, ou par vapiCallId en repli).
    let contact = null;
    if (contactId) {
      contact = await prisma.contact.findUnique({ where: { id: contactId } });
    }
    if (!contact && vapiCallId) {
      contact = await prisma.contact.findUnique({ where: { vapiCallId } });
    }
    if (contact) {
      const endedReason = typeof msg.endedReason === "string" ? msg.endedReason : "";
      // Reasons Vapi : customer-did-not-answer, customer-busy, voicemail, pipeline-error…
      const noAnswer = /no.?answer|did.?not.?answer|voicemail|busy|machine|unreachable/i.test(endedReason);
      const failed = /error|failed|rejected|invalid/i.test(endedReason);
      const status = failed ? "failed" : noAnswer ? "no_answer" : "completed";
      await prisma.contact.update({
        where: { id: contact.id },
        data: {
          status,
          outcome: outcome.slice(0, 240),
          calledAt: new Date(),
        },
      });

      // Cloture la campagne si plus aucun contact n'est en attente / en cours.
      const cid = campaignId ?? contact.campaignId;
      if (cid) {
        const remaining = await prisma.contact.count({
          where: { campaignId: cid, status: { in: ["pending", "calling"] } },
        });
        if (remaining === 0) {
          await prisma.campaign.update({
            where: { id: cid },
            data: { status: "completed" },
          });
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
