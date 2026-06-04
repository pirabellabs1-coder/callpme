"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/client";
import { requireSession } from "@/lib/auth/session";
import { isPlanId, getPlan } from "@/lib/billing/plans";
import { sendEmail } from "@/lib/email/resend";
import { subscriptionEmail } from "@/lib/email/templates";

export interface BillingResult {
  ok?: boolean;
  error?: string;
}

/** Change l'offre de l'organisation courante. Persisté et appliqué aussitôt. */
export async function switchPlan(planId: string): Promise<BillingResult> {
  const session = await requireSession();
  if (!isPlanId(planId)) return { error: "Offre inconnue." };

  await prisma.organization.update({
    where: { id: session.org.id },
    data: { plan: planId },
  });

  // Confirmation par e-mail (best-effort)
  const mail = subscriptionEmail(session.user.name ?? "", getPlan(planId).name);
  void sendEmail({
    to: session.user.email,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
  }).catch(() => {});

  revalidatePath("/billing");
  return { ok: true };
}
