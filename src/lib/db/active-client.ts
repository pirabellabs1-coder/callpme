/** Client actif (espace agence) — mémorisé dans un cookie. */
import { cookies } from "next/headers";
import { prisma } from "./client";

export const CLIENT_COOKIE = "cpme_client";

export async function getActiveClientId(orgId: string): Promise<string | null> {
  const id = cookies().get(CLIENT_COOKIE)?.value;
  if (!id) return null;
  const c = await prisma.client.findFirst({
    where: { id, organizationId: orgId },
    select: { id: true },
  });
  return c?.id ?? null;
}
