"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/session";
import { companySchema, saveCompany } from "@/lib/billing/company";

export interface CompanyResult {
  ok?: boolean;
  error?: string;
}

/** Enregistre les informations légales qui figureront sur les prochaines factures. */
export async function saveCompanyAction(input: unknown): Promise<CompanyResult> {
  await requireAdmin();
  const parsed = companySchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Informations invalides." };
  await saveCompany(parsed.data);
  revalidatePath("/admin/societe");
  return { ok: true };
}
