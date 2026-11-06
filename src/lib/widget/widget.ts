/**
 * Widget « site web » : un bouton à intégrer sur le site d'un client pour que
 * ses visiteurs parlent à l'agent au micro. Module pur (client et serveur).
 *
 * Sécurité : le widget ne fonctionne que sur les domaines déclarés (contrôle
 * de l'en-tête Origin côté serveur), l'agent doit être en ligne, et chaque
 * conversation compte dans les minutes de l'offre.
 */
import { z } from "zod";
import type { WidgetConfig } from "../shared/types";

export const WIDGET_DEFAULTS: WidgetConfig = {
  enabled: false,
  allowedDomains: [],
  label: "Parler à notre assistant",
  color: "#E8572A",
  position: "right",
};

/** « https://www.exemple.bj/contact » → « www.exemple.bj ». Renvoie null si invalide. */
export function normalizeDomain(input: string): string | null {
  let s = input.trim().toLowerCase();
  if (!s) return null;
  s = s.replace(/^[a-z]+:\/\//, "").split(/[/?#]/)[0].replace(/:\d+$/, "").replace(/\.$/, "");
  if (s === "localhost") return s;
  return /^(?=.{3,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(s) ? s : null;
}

/**
 * L'origine de la page est-elle autorisée ? Un domaine déclaré couvre aussi
 * ses sous-domaines (« exemple.bj » autorise « www.exemple.bj »).
 */
export function originAllowed(origin: string | null | undefined, domains: string[]): boolean {
  if (!origin) return false;
  let host: string;
  try {
    const u = new URL(origin);
    if (u.protocol !== "https:" && !(u.protocol === "http:" && u.hostname === "localhost")) return false;
    host = u.hostname.toLowerCase();
  } catch {
    return false;
  }
  return domains.some((d) => host === d || host.endsWith(`.${d}`));
}

const domain = z.string().transform((v, ctx) => {
  const d = normalizeDomain(v);
  if (!d) {
    ctx.addIssue({ code: "custom", message: `Domaine invalide : ${v}` });
    return z.NEVER;
  }
  return d;
});

export const widgetSchema = z.object({
  enabled: z.boolean(),
  allowedDomains: z.array(domain).max(10, "10 domaines au maximum"),
  label: z.string().trim().min(1).max(40).optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "Couleur au format #RRGGBB")
    .optional(),
  position: z.enum(["right", "left"]).optional(),
});

/** Code à coller sur le site, juste avant </body>. */
export function widgetSnippet(appUrl: string, agentId: string): string {
  const base = appUrl.replace(/\/$/, "");
  return `<script src="${base}/widget.js" data-agent="${agentId}" async></script>`;
}
