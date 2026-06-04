import { NextRequest } from "next/server";
import { randomBytes } from "crypto";
import { z } from "zod";
import { getSession } from "@/lib/auth/session";
import {
  listCustomToolsFull,
  createCustomTool,
  getCustomToolByName,
} from "@/lib/db/custom-tools";
import type { JSONSchema, JSONSchemaProperty } from "@/lib/shared/types";
import {
  ok,
  created,
  badRequest,
  unauthorized,
  serverError,
} from "@/lib/api/respond";

export const dynamic = "force-dynamic";

const IDENT = /^[a-zA-Z][a-zA-Z0-9_]*$/;

const fieldSchema = z.object({
  name: z.string().regex(IDENT, "Identifiant de champ invalide").max(40),
  type: z.enum(["string", "number", "boolean", "integer"]),
  description: z.string().max(200).optional(),
  required: z.boolean().optional(),
});

const createSchema = z.object({
  name: z.string().regex(IDENT, "Identifiant invalide (lettres, chiffres, _)").max(60),
  label: z.string().min(1).max(80),
  description: z.string().min(1).max(500),
  serverUrl: z.string().url().max(500).optional().or(z.literal("")),
  method: z.enum(["POST", "GET", "PUT"]).optional(),
  fields: z.array(fieldSchema).max(20),
  async: z.boolean().optional(),
  strict: z.boolean().optional(),
  lockSchema: z.boolean().optional(),
});

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();
  const tools = await listCustomToolsFull(session.org.id);
  return ok({ functions: tools });
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();
    const body = await req.json().catch(() => null);
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest(
        parsed.error.issues[0]?.message ?? "Données invalides",
        parsed.error.flatten(),
      );
    }
    const d = parsed.data;
    if (await getCustomToolByName(session.org.id, d.name)) {
      return badRequest("Une fonction porte déjà ce nom.");
    }

    const properties: Record<string, JSONSchemaProperty> = {};
    const required: string[] = [];
    for (const f of d.fields) {
      properties[f.name] = { type: f.type, description: f.description };
      if (f.required) required.push(f.name);
    }
    const parameters: JSONSchema = { type: "object", properties, required };
    if (d.lockSchema) parameters.additionalProperties = false;

    const tool = await createCustomTool(session.org.id, {
      name: d.name,
      label: d.label,
      description: d.description,
      parameters,
      serverUrl: d.serverUrl || null,
      secret: `whsec_${randomBytes(16).toString("hex")}`,
      method: d.method ?? "POST",
      async: d.async ?? false,
      strict: d.strict ?? false,
      lockSchema: d.lockSchema ?? false,
    });
    return created({ function: tool });
  } catch {
    return serverError("Impossible de créer la fonction");
  }
}
