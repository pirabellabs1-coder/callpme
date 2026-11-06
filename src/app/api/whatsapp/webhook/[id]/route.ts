import { NextRequest } from "next/server";
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/db/client";
import { decryptSecret } from "@/lib/crypto/secrets";
import { verifyMetaSignature } from "@/lib/whatsapp/cloud";
import { handleWhatsAppWebhook } from "@/lib/whatsapp/handler";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const text = (body: string, status = 200) => new Response(body, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });

async function findChannel(id: string) {
  if (!/^[a-z0-9]{10,40}$/i.test(id)) return null;
  return prisma.whatsAppChannel.findUnique({ where: { id } });
}

/** Vérification de l'abonnement par Meta (hub.challenge). */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const p = req.nextUrl.searchParams;
  const channel = await findChannel(params.id);
  const given = Buffer.from(p.get("hub.verify_token") ?? "");
  const expected = Buffer.from(channel?.verifyToken ?? "");
  const tokenOk = given.length === expected.length && expected.length > 0 && timingSafeEqual(given, expected);
  if (!channel || p.get("hub.mode") !== "subscribe" || !tokenOk) {
    return text("Forbidden", 403);
  }
  return text(p.get("hub.challenge") ?? "");
}

/** Messages reçus : signature HMAC de l'application Meta obligatoire. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  // Taille annoncée vérifiée avant de lire le corps (requête non authentifiée).
  if (Number(req.headers.get("content-length") ?? 0) > 1_000_000) return text("Payload too large", 413);
  const raw = await req.text();
  if (raw.length > 1_000_000) return text("Payload too large", 413);
  const channel = await findChannel(params.id);
  // Même réponse qu'une mauvaise signature : on ne révèle pas quels canaux existent.
  if (!channel) return text("Invalid signature", 401);
  const secret = decryptSecret(channel.appSecret) ?? "";
  if (!verifyMetaSignature(secret, raw, req.headers.get("x-hub-signature-256"))) return text("Invalid signature", 401);
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return text("Bad request", 400);
  }
  try {
    await handleWhatsAppWebhook(channel, payload as Parameters<typeof handleWhatsAppWebhook>[1]);
  } catch (e) {
    console.error("[whatsapp] webhook :", e instanceof Error ? e.message : e);
  }
  // Toujours 200 une fois la signature vérifiée : sinon Meta renvoie le message en boucle.
  return text("ok");
}
