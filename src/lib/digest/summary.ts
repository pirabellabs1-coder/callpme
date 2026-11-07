/**
 * Résumé quotidien : contenu (module pur, testable sans base).
 * Le même résumé existe en trois formes : e-mail HTML, texte brut, et une
 * ligne unique pour le paramètre d'un modèle WhatsApp (Meta refuse les sauts
 * de ligne et les tabulations dans les paramètres).
 */
import { emailLayout, escapeHtml } from "../email/templates";

export interface DigestUrgent {
  /** Ex. « Rappel demandé — Koffi A. » */
  label: string;
  phone?: string | null;
  /** Chemin du tableau de bord (ex. /leads, /calls/abc). */
  href: string;
}

export interface DigestData {
  orgName: string;
  /** Jour local AAAA-MM-JJ. */
  day: string;
  calls: { received: number; missed: number; outbound: number };
  callbacks: { completed: number; unreached: number };
  appointments: number;
  leads: number;
  urgent: DigestUrgent[];
}

/** Au plus 10 urgences listées ; le reste est compté. */
export const MAX_URGENT_LISTED = 10;
/** Paramètre de modèle WhatsApp : limite prudente (Meta : 1 024 caractères). */
export const WHATSAPP_PARAM_MAX = 900;

export function hasActivity(d: DigestData): boolean {
  return (
    d.calls.received + d.calls.outbound + d.callbacks.completed + d.callbacks.unreached + d.appointments + d.leads + d.urgent.length > 0
  );
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n > 1 ? many : one}`;
}

/** « samedi 7 novembre » : le jour local est déjà calculé, on le formate en UTC à midi. */
export function dayLabel(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, d, 12)),
  );
}

/** Lignes chiffrées, dans l'ordre d'affichage. */
export function digestLines(d: DigestData): string[] {
  const lines = [
    `${plural(d.calls.received, "appel reçu", "appels reçus")}, dont ${plural(d.calls.missed, "manqué", "manqués")}`,
  ];
  if (d.calls.outbound) lines.push(plural(d.calls.outbound, "appel sortant", "appels sortants"));
  if (d.callbacks.completed || d.callbacks.unreached) {
    lines.push(
      `${plural(d.callbacks.completed, "appelant rappelé", "appelants rappelés")}` +
        (d.callbacks.unreached ? `, ${plural(d.callbacks.unreached, "rappel sans réponse", "rappels sans réponse")}` : ""),
    );
  }
  lines.push(plural(d.appointments, "rendez-vous pris", "rendez-vous pris"));
  lines.push(plural(d.leads, "fiche client créée", "fiches clients créées"));
  return lines;
}

function abs(base: string, href: string): string {
  return `${base.replace(/\/+$/, "")}${href.startsWith("/") ? href : `/${href}`}`;
}

export interface BuiltDigest {
  subject: string;
  text: string;
  html: string;
  /** Une seule ligne, pour le paramètre {{1}} du modèle WhatsApp. */
  whatsappParam: string;
}

export function buildDigest(d: DigestData, baseUrl: string): BuiltDigest {
  const label = dayLabel(d.day);
  const lines = digestLines(d);
  const listed = d.urgent.slice(0, MAX_URGENT_LISTED);
  const more = d.urgent.length - listed.length;
  const subject = `Callpme · Résumé du ${label}${d.urgent.length ? ` · ${plural(d.urgent.length, "urgence", "urgences")}` : ""}`;

  const urgentText = listed.map((u) => `- ${u.label}${u.phone ? ` (${u.phone})` : ""} : ${abs(baseUrl, u.href)}`);
  const text = [
    `Résumé de la journée — ${d.orgName} — ${label}`,
    "",
    ...lines.map((l) => `• ${l}`),
    ...(listed.length ? ["", "À rappeler en priorité :", ...urgentText] : []),
    ...(more > 0 ? [`… et ${more} de plus.`] : []),
    "",
    `Tableau de bord : ${abs(baseUrl, "/overview")}`,
  ].join("\n");

  const li = (s: string) => `<li style="margin:0 0 4px;">${s}</li>`;
  const urgentHtml = listed.length
    ? `<p style="margin:18px 0 6px;font-weight:600;color:#1c1917;">À rappeler en priorité</p><ul style="margin:0;padding-left:18px;">${listed
        .map((u) =>
          li(
            `<a href="${escapeHtml(abs(baseUrl, u.href))}" style="color:#E8572A;">${escapeHtml(u.label)}</a>${
              u.phone ? ` · ${escapeHtml(u.phone)}` : ""
            }`,
          ),
        )
        .join("")}</ul>${more > 0 ? `<p style="margin:6px 0 0;">… et ${more} de plus.</p>` : ""}`
    : "";
  const html = emailLayout({
    preheader: lines.join(" · "),
    heading: `Votre journée du ${escapeHtml(label)}`,
    bodyHtml: `<ul style="margin:0;padding-left:18px;">${lines.map((l) => li(escapeHtml(l))).join("")}</ul>${urgentHtml}`,
    ctaLabel: "Ouvrir le tableau de bord",
    ctaUrl: abs(baseUrl, "/overview"),
    footnote: `Résumé quotidien de l'espace ${escapeHtml(d.orgName)}. Réglez l'heure et les destinataires dans Réglages › Alertes.`,
  });

  const urgentOneLine = listed.length
    ? ` · À rappeler : ${listed.map((u) => `${u.label}${u.phone ? ` ${u.phone}` : ""}`).join(" ; ")}${more > 0 ? ` (+${more})` : ""}`
    : "";
  const whatsappParam = oneLine(`${d.orgName}, ${label} : ${lines.join(" · ")}${urgentOneLine} · ${abs(baseUrl, "/overview")}`);

  return { subject, text, html, whatsappParam };
}

/** Paramètre de modèle WhatsApp : pas de saut de ligne, de tabulation ni plus de 4 espaces de suite. */
export function oneLine(s: string, max = WHATSAPP_PARAM_MAX): string {
  const flat = s.replace(/[\r\n\t]+/g, " ").replace(/ {2,}/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}
