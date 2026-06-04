"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/db/client";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import {
  createSession,
  setSessionCookie,
  destroySession,
} from "@/lib/auth/session";
import { isPlanId } from "@/lib/billing/plans";
import { sendEmail } from "@/lib/email/resend";
import { welcomeEmail } from "@/lib/email/templates";

export interface AuthResult {
  ok?: boolean;
  error?: string;
}

const loginSchema = z.object({
  email: z.string().email("E-mail invalide"),
  password: z.string().min(1, "Mot de passe requis"),
});

export async function login(formData: FormData): Promise<AuthResult> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: "E-mail ou mot de passe invalide." };
  }
  const email = parsed.data.email.toLowerCase().trim();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    return { error: "Identifiants incorrects." };
  }
  const token = await createSession(user.id);
  setSessionCookie(token);
  return { ok: true };
}

const registerSchema = z.object({
  organizationName: z.string().min(2, "Nom d'organisation trop court"),
  name: z.string().min(1, "Nom requis"),
  email: z.string().email("E-mail invalide"),
  password: z.string().min(8, "8 caractères minimum"),
  plan: z.string().optional(),
});

export async function register(formData: FormData): Promise<AuthResult> {
  const parsed = registerSchema.safeParse({
    organizationName: formData.get("organizationName"),
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    plan: formData.get("plan") ?? undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Champs invalides." };
  }
  const email = parsed.data.email.toLowerCase().trim();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "Un compte existe déjà avec cet e-mail." };
  }
  const plan =
    parsed.data.plan && isPlanId(parsed.data.plan) ? parsed.data.plan : "starter";
  const passwordHash = await hashPassword(parsed.data.password);

  const org = await prisma.organization.create({
    data: {
      name: parsed.data.organizationName.trim(),
      plan,
      users: {
        create: {
          email,
          name: parsed.data.name.trim(),
          passwordHash,
          role: "owner",
        },
      },
    },
    include: { users: true },
  });

  const token = await createSession(org.users[0].id);
  setSessionCookie(token);

  // E-mail de bienvenue (best-effort, ne bloque pas l'inscription)
  const wel = welcomeEmail(
    parsed.data.name.trim(),
    parsed.data.organizationName.trim(),
  );
  void sendEmail({
    to: email,
    subject: wel.subject,
    html: wel.html,
    text: wel.text,
  }).catch(() => {});

  return { ok: true };
}

export async function logout(): Promise<void> {
  await destroySession();
  redirect("/login");
}
