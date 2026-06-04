"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { requireSession } from "@/lib/auth/session";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { sendEmail } from "@/lib/email/resend";
import { passwordChangedEmail } from "@/lib/email/templates";

export interface SettingsResult {
  ok?: boolean;
  error?: string;
}

/** Met à jour le nom de l'organisation courante. */
export async function updateOrganization(
  formData: FormData,
): Promise<SettingsResult> {
  const session = await requireSession();
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2) {
    return { error: "Le nom doit contenir au moins 2 caractères." };
  }
  await prisma.organization.update({
    where: { id: session.org.id },
    data: { name },
  });
  revalidatePath("/settings");
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Met à jour le profil de l'utilisateur courant (nom + e-mail). */
export async function updateProfile(
  formData: FormData,
): Promise<SettingsResult> {
  const session = await requireSession();
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();

  const parsed = z
    .object({ name: z.string().min(2), email: z.string().email() })
    .safeParse({ name, email });
  if (!parsed.success) {
    return { error: "Nom ou adresse e-mail invalide." };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing && existing.id !== session.user.id) {
    return { error: "Un compte existe déjà avec cet e-mail." };
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { name, email },
  });
  revalidatePath("/settings");
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Change le mot de passe après vérification de l'actuel. */
export async function changePassword(
  formData: FormData,
): Promise<SettingsResult> {
  const session = await requireSession();
  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");

  if (next.length < 8) {
    return { error: "Le nouveau mot de passe doit faire au moins 8 caractères." };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });
  if (!user || !(await verifyPassword(current, user.passwordHash))) {
    return { error: "Mot de passe actuel incorrect." };
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { passwordHash: await hashPassword(next) },
  });

  // Notification de sécurité (best-effort)
  const mail = passwordChangedEmail(session.user.name ?? "");
  void sendEmail({
    to: session.user.email,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
  }).catch(() => {});

  return { ok: true };
}
