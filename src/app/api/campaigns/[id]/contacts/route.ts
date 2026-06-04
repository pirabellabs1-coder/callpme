import { NextRequest } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import { addContacts } from "@/lib/db/campaigns";
import { ok, badRequest, unauthorized, serverError } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

const schema = z.object({
  contacts: z
    .array(
      z.object({
        name: z.string().max(120).optional(),
        phone: z.string().min(3).max(40),
      }),
    )
    .max(5000),
});

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();
    const body = await req.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest("Contacts invalides");
    const added = await addContacts(
      session.org.id,
      params.id,
      parsed.data.contacts.map((c) => ({ name: c.name ?? "Contact", phone: c.phone })),
    );
    return ok({ added });
  } catch {
    return serverError();
  }
}
