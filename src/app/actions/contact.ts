"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { brandedEmail, sendEmail } from "@/lib/email/resend";

/**
 * Formulaires publics « Contact » et « Partenariat ».
 * - Validation serveur (zod) : le client n'est jamais cru.
 * - Anti-spam : champ piège invisible (`website`) + limite de 5 envois par
 *   heure et par adresse IP (mémoire du processus, suffisant pour démarrer).
 * - Tout contenu utilisateur est échappé avant d'être inséré dans l'e-mail.
 */

const CONTACT_TO = process.env.CONTACT_TO || "contact@pirabellabs.com";

export interface ContactResult {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
}

const contactSchema = z.object({
  name: z.string().trim().min(2, "Indiquez votre nom").max(100),
  email: z.string().trim().email("E-mail invalide").max(160),
  company: z.string().trim().max(120).optional().default(""),
  subject: z.enum(["demo", "commercial", "support", "presse", "autre"], {
    message: "Choisissez un sujet",
  }),
  message: z.string().trim().min(10, "Votre message est trop court").max(4000),
});

const partnerSchema = z.object({
  name: z.string().trim().min(2, "Indiquez votre nom").max(100),
  email: z.string().trim().email("E-mail invalide").max(160),
  agency: z.string().trim().min(2, "Indiquez le nom de votre structure").max(120),
  country: z.string().trim().min(2, "Indiquez votre pays").max(80),
  website: z.string().trim().max(200).optional().default(""),
  clients: z.enum(["1-5", "6-20", "21-50", "50+"], { message: "Choisissez une tranche" }),
  message: z.string().trim().min(10, "Décrivez votre projet en quelques mots").max(4000),
});

const SUBJECT_LABEL: Record<string, string> = {
  demo: "Demande de démo",
  commercial: "Question commerciale",
  support: "Support",
  presse: "Presse",
  autre: "Autre",
};

/* ------------------------------ Anti-abus ------------------------------ */

const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const hits = new Map<string, number[]>();

function rateLimited(key: string): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    hits.set(key, recent);
    return true;
  }
  recent.push(now);
  hits.set(key, recent);
  return false;
}

function clientIp(): string {
  const h = headers();
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "unknown").trim();
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function rows(entries: [string, string][]): string {
  return entries
    .filter(([, v]) => v)
    .map(
      ([k, v]) =>
        `<p style="margin:0 0 10px;"><strong>${escapeHtml(k)} :</strong><br/>${escapeHtml(v).replace(/\n/g, "<br/>")}</p>`,
    )
    .join("");
}

function fieldErrors(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = String(issue.path[0] ?? "");
    if (key && !out[key]) out[key] = issue.message;
  }
  return out;
}

async function guard(formData: FormData): Promise<ContactResult | null> {
  // Champ piège : un robot le remplit, un humain ne le voit pas.
  if (String(formData.get("hp_website") ?? "").length > 0) return { ok: true };
  if (rateLimited(clientIp())) {
    return { error: "Trop d'envois depuis votre connexion. Réessayez dans une heure." };
  }
  return null;
}

/* ------------------------------- Actions ------------------------------- */

export async function sendContact(formData: FormData): Promise<ContactResult> {
  const blocked = await guard(formData);
  if (blocked) return blocked;

  const parsed = contactSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Vérifiez les champs indiqués.", fieldErrors: fieldErrors(parsed.error) };
  const d = parsed.data;

  const res = await sendEmail({
    to: CONTACT_TO,
    subject: `[Contact] ${SUBJECT_LABEL[d.subject]} · ${d.name}`,
    html: brandedEmail(
      "Nouveau message depuis le site",
      rows([
        ["Nom", d.name],
        ["E-mail", d.email],
        ["Entreprise", d.company],
        ["Sujet", SUBJECT_LABEL[d.subject]],
        ["Message", d.message],
      ]),
    ),
  });
  if (!res.ok) {
    console.error("[contact] envoi impossible :", res.error);
    return { error: `L'envoi a échoué. Écrivez-nous directement à ${CONTACT_TO}.` };
  }
  return { ok: true };
}

export async function sendPartnerRequest(formData: FormData): Promise<ContactResult> {
  const blocked = await guard(formData);
  if (blocked) return blocked;

  const parsed = partnerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Vérifiez les champs indiqués.", fieldErrors: fieldErrors(parsed.error) };
  const d = parsed.data;

  const res = await sendEmail({
    to: CONTACT_TO,
    subject: `[Partenariat] ${d.agency} (${d.country})`,
    html: brandedEmail(
      "Nouvelle demande de partenariat",
      rows([
        ["Nom", d.name],
        ["E-mail", d.email],
        ["Structure", d.agency],
        ["Pays", d.country],
        ["Site web", d.website],
        ["Nombre de clients", d.clients],
        ["Projet", d.message],
      ]),
    ),
  });
  if (!res.ok) {
    console.error("[partenariat] envoi impossible :", res.error);
    return { error: `L'envoi a échoué. Écrivez-nous directement à ${CONTACT_TO}.` };
  }
  return { ok: true };
}
