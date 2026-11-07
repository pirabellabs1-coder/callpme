"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/session";
import { stockImportSchema } from "@/lib/numbers/market";
import {
  MarketError,
  approveNumberRequest,
  deleteStock,
  importStock,
  rejectNumberRequest,
  releaseOrphanReservation,
  setStockEnabled,
} from "@/lib/numbers/market-db";
import { billingRecipients } from "@/lib/payments/notify";
import { sendEmail, hasResend } from "@/lib/email/resend";
import { numberRequestEmail } from "@/lib/email/templates";

export interface AdminMarketResult {
  ok?: boolean;
  error?: string;
  info?: string;
}

const PATH = "/admin/marketplace-numeros";

function audit(action: string, by: string, detail: string) {
  console.info(JSON.stringify({ scope: "marketplace-numeros", action, by, detail }));
}

async function notify(organizationId: string, approved: boolean, number?: string, note?: string | null) {
  if (!hasResend()) return;
  const to = (await billingRecipients(organizationId)).map((u) => u.email).filter(Boolean);
  if (to.length === 0) return;
  const mail = numberRequestEmail({ approved, number, note });
  await sendEmail({ to, ...mail }).catch(() => undefined);
}

export async function importStockAction(input: unknown): Promise<AdminMarketResult> {
  const admin = await requireAdmin();
  const parsed = stockImportSchema.safeParse(input);
  if (!parsed.success) return { error: "Vérifiez le pays, le réseau, les prix et la liste de numéros." };
  const res = await importStock(parsed.data);
  audit("import", admin.user.id, `${parsed.data.country}/${parsed.data.network} +${res.added}`);
  revalidatePath(PATH);
  const parts = [`${res.added} numéro(s) ajouté(s)`];
  if (res.skipped) parts.push(`${res.skipped} déjà en stock ou utilisé(s)`);
  if (res.invalid.length) parts.push(`invalides : ${res.invalid.slice(0, 5).join(", ")}${res.invalid.length > 5 ? "…" : ""}`);
  return { ok: res.added > 0, info: parts.join(" · "), error: res.added === 0 && !res.skipped ? "Aucun numéro valide." : undefined };
}

export async function toggleStockAction(id: string, enabled: boolean): Promise<AdminMarketResult> {
  const admin = await requireAdmin();
  const done = await setStockEnabled(String(id), Boolean(enabled));
  if (!done) return { error: "Numéro réservé, attribué ou introuvable." };
  audit(enabled ? "enable" : "disable", admin.user.id, String(id));
  revalidatePath(PATH);
  return { ok: true };
}

export async function releaseStockAction(id: string): Promise<AdminMarketResult> {
  const admin = await requireAdmin();
  const done = await releaseOrphanReservation(String(id));
  if (!done) return { error: "Ce numéro est réservé par une demande encore en attente : traitez la demande." };
  audit("release", admin.user.id, String(id));
  revalidatePath(PATH);
  return { ok: true };
}

export async function deleteStockAction(id: string): Promise<AdminMarketResult> {
  const admin = await requireAdmin();
  const done = await deleteStock(String(id));
  if (!done) return { error: "Seul un numéro libre ou en pause peut être supprimé." };
  audit("delete", admin.user.id, String(id));
  revalidatePath(PATH);
  return { ok: true };
}

export async function approveRequestAction(id: string, stockId: string | null, note: string): Promise<AdminMarketResult> {
  const admin = await requireAdmin();
  const cleanNote = String(note ?? "").trim().slice(0, 400) || null;
  try {
    const res = await approveNumberRequest(String(id), stockId ? String(stockId) : null, cleanNote);
    audit("approve", admin.user.id, `${id} → ${res.number}`);
    await notify(res.organizationId, true, res.number, cleanNote);
  } catch (e) {
    if (e instanceof MarketError) return { error: e.message };
    console.error("[marketplace-numeros] attribution impossible", e);
    return { error: "Attribution impossible. Réessayez." };
  }
  revalidatePath(PATH);
  return { ok: true };
}

export async function rejectRequestAction(id: string, note: string): Promise<AdminMarketResult> {
  const admin = await requireAdmin();
  const cleanNote = String(note ?? "").trim().slice(0, 400) || null;
  const res = await rejectNumberRequest(String(id), cleanNote);
  if (!res) return { error: "Demande introuvable ou déjà traitée." };
  audit("reject", admin.user.id, String(id));
  await notify(res.organizationId, false, undefined, cleanNote);
  revalidatePath(PATH);
  return { ok: true };
}
