/**
 * Envoi des prospects vers les CRM connectés (HubSpot, Pipedrive).
 * Chaque envoi est indépendant : l'échec de l'un n'empêche pas l'autre, et
 * n'empêche jamais l'enregistrement dans Callpme.
 */
import { integrationCredentials } from "./credentials";

export interface CrmLead {
  name: string;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
}

export interface CrmIds {
  hubspot?: string;
  pipedrive?: string;
}

function splitName(name: string): { first: string; last: string } {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? { first: parts.slice(0, -1).join(" "), last: parts[parts.length - 1] } : { first: name, last: "" };
}

async function hubspot(token: string, lead: CrmLead, existingId?: string): Promise<string | null> {
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
  const { first, last } = splitName(lead.name);
  const properties: Record<string, string> = { firstname: first, lastname: last };
  if (lead.phone) properties.phone = lead.phone;
  if (lead.email) properties.email = lead.email;

  // Un contact existant n'est jamais modifié (l'appelant pourrait usurper une
  // identité) : on ajoute seulement une note.
  let id = existingId ?? null;
  if (!id) {
    const res = await fetch("https://api.hubapi.com/crm/v3/objects/contacts", {
      method: "POST",
      headers,
      body: JSON.stringify({ properties }),
      signal: AbortSignal.timeout(8000),
    });
    const data = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    // Contact déjà existant (même e-mail) : HubSpot renvoie son identifiant.
    id = data.id ?? data.message?.match(/Existing ID:\s*(\d+)/)?.[1] ?? null;
  }
  if (id && lead.notes) {
    await fetch("https://api.hubapi.com/crm/v3/objects/notes", {
      method: "POST",
      headers,
      body: JSON.stringify({
        properties: { hs_timestamp: new Date().toISOString(), hs_note_body: `Appel Callpme — ${lead.notes}` },
        associations: [{ to: { id }, types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 202 }] }],
      }),
      signal: AbortSignal.timeout(8000),
    }).catch(() => {});
  }
  return id;
}

async function pipedrive(token: string, lead: CrmLead, existingId?: string): Promise<string | null> {
  const headers = { "x-api-token": token, "Content-Type": "application/json" };
  let id = existingId ?? null;
  if (!id) {
    const res = await fetch("https://api.pipedrive.com/v1/persons", {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: lead.name,
        ...(lead.phone ? { phone: [{ value: lead.phone, primary: true }] } : {}),
        ...(lead.email ? { email: [{ value: lead.email, primary: true }] } : {}),
      }),
      signal: AbortSignal.timeout(8000),
    });
    const data = (await res.json().catch(() => ({}))) as { data?: { id?: number } };
    id = data.data?.id ? String(data.data.id) : null;
  }
  if (id && lead.notes) {
    await fetch("https://api.pipedrive.com/v1/notes", {
      method: "POST",
      headers,
      body: JSON.stringify({ content: `Appel Callpme — ${lead.notes}`, person_id: Number(id) }),
      signal: AbortSignal.timeout(8000),
    }).catch(() => {});
  }
  return id;
}

/** Pousse le prospect dans chaque CRM connecté ; renvoie les identifiants obtenus. */
export async function pushLeadToCrms(orgId: string, lead: CrmLead, known: CrmIds = {}): Promise<CrmIds> {
  const [hs, pd] = await Promise.all([
    integrationCredentials(orgId, "hubspot"),
    integrationCredentials(orgId, "pipedrive"),
  ]);
  const ids: CrmIds = { ...known };
  await Promise.all([
    hs?.access_token
      ? hubspot(hs.access_token, lead, known.hubspot).then((id) => id && (ids.hubspot = id)).catch(() => {})
      : null,
    pd?.api_token
      ? pipedrive(pd.api_token, lead, known.pipedrive).then((id) => id && (ids.pipedrive = id)).catch(() => {})
      : null,
  ]);
  return ids;
}
