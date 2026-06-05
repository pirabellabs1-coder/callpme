"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/client";
import { verifyPassword } from "@/lib/auth/password";
import { createSession, setSessionCookie } from "@/lib/auth/session";
import {
  adminGateSlug,
  adminPassphrase,
  safeEqual,
  makeAdminToken,
  setAdminCookie,
  clearAdminCookie,
} from "@/lib/auth/admin-gate";

export interface GateResult {
  ok?: boolean;
  error?: string;
}

/** Petit délai pour ralentir les tentatives par force brute. */
function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Connexion admin via la porte secrète : identifiants + (option) phrase
 * secrète. En cas de succès, pose la session ET le cookie élevé d'admin.
 * Tous les échecs renvoient le même message générique (pas de divulgation).
 */
export async function adminGateLogin(formData: FormData): Promise<GateResult> {
  const gate = String(formData.get("gate") || "");
  const email = String(formData.get("email") || "").toLowerCase().trim();
  const password = String(formData.get("password") || "");
  const passphrase = String(formData.get("passphrase") || "");

  const fail: GateResult = { error: "Accès refusé. Vérifiez vos informations." };

  // L'URL secrète doit correspondre (re-vérification côté serveur).
  if (!safeEqual(gate, adminGateSlug())) {
    await sleep(600);
    return fail;
  }

  if (!email || !password) return fail;

  const user = await prisma.user.findUnique({ where: { email } });
  const passOk = user ? await verifyPassword(password, user.passwordHash) : false;

  // Phrase secrète (si configurée).
  const required = adminPassphrase();
  const phraseOk = required ? safeEqual(passphrase, required) : true;

  if (!user || !passOk || !user.isAdmin || !phraseOk) {
    await sleep(600);
    return fail;
  }

  const token = await createSession(user.id);
  setSessionCookie(token);
  setAdminCookie(makeAdminToken(user.id));
  return { ok: true };
}

/** Verrouille l'espace admin (révoque le cookie élevé) et sort du panneau. */
export async function lockAdmin(): Promise<void> {
  clearAdminCookie();
  redirect("/overview");
}
