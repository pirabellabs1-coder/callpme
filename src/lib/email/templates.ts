/**
 * Gabarits d'e-mails Callpme — un layout responsive soigné (carte blanche,
 * accent orange, bouton CTA, pied de page) + des e-mails transactionnels prêts
 * à l'emploi. Chaque fonction renvoie { subject, html, text }.
 */

const BRAND = "#E8572A";

function baseUrl(): string {
  return process.env.PUBLIC_URL || "http://localhost:3000";
}

interface LayoutOpts {
  preheader?: string;
  heading: string;
  bodyHtml: string;
  ctaLabel?: string;
  ctaUrl?: string;
  footnote?: string;
}

/** Layout HTML commun (tables inline pour compatibilité clients mail). */
export function emailLayout(o: LayoutOpts): string {
  const cta =
    o.ctaLabel && o.ctaUrl
      ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
           <tr><td style="border-radius:10px;background:${BRAND};">
             <a href="${o.ctaUrl}" style="display:inline-block;padding:12px 22px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;">${o.ctaLabel}</a>
           </td></tr>
         </table>`
      : "";
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"></head>
<body style="margin:0;padding:0;background:#faf7f5;">
  ${o.preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(o.preheader)}</div>` : ""}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#faf7f5;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:560px;max-width:100%;">
        <tr><td style="padding-bottom:20px;">
          <table role="presentation" cellpadding="0" cellspacing="0"><tr>
            <td style="vertical-align:middle;"><div style="width:28px;height:28px;border-radius:8px;background:${BRAND};"></div></td>
            <td style="vertical-align:middle;padding-left:8px;font-size:18px;font-weight:700;color:#1c1917;">Callpme</td>
          </tr></table>
        </td></tr>
        <tr><td style="background:#ffffff;border:1px solid #ece7e3;border-radius:16px;padding:32px;">
          <h1 style="margin:0 0 14px;font-size:21px;line-height:1.3;color:#1c1917;">${o.heading}</h1>
          <div style="font-size:15px;line-height:1.65;color:#44403c;">${o.bodyHtml}</div>
          ${cta}
          ${o.footnote ? `<p style="margin:20px 0 0;font-size:13px;line-height:1.5;color:#a8a29e;">${o.footnote}</p>` : ""}
        </td></tr>
        <tr><td style="padding-top:20px;text-align:center;">
          <p style="margin:0;font-size:12px;line-height:1.6;color:#a8a29e;">Callpme — agents vocaux IA pour les entreprises.<br/>Vous recevez cet e-mail car vous avez un compte sur la plateforme.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function toText(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

/* ------------------------------ Bienvenue -------------------------------- */

export function welcomeEmail(name: string, orgName: string): EmailContent {
  const html = emailLayout({
    preheader: "Votre espace Callpme est prêt.",
    heading: `Bienvenue sur Callpme`,
    bodyHtml: `<p style="margin:0 0 12px;">Bonjour ${name || ""},</p>
      <p style="margin:0 0 12px;">Votre espace <strong>${orgName}</strong> est prêt. Vous pouvez dès maintenant créer votre premier agent vocal, choisir sa voix et le tester en direct dans le navigateur.</p>
      <p style="margin:0;">Tout est opérationnel : agents par rôle, campagnes d'appels, base de connaissances, studio de voix et API développeur.</p>`,
    ctaLabel: "Créer mon premier agent",
    ctaUrl: `${baseUrl()}/agents/new`,
    footnote: "Besoin d'aide ? Répondez simplement à cet e-mail.",
  });
  return { subject: "Bienvenue sur Callpme", html, text: toText(html) };
}

/* --------------------------- Mot de passe -------------------------------- */

export function passwordChangedEmail(name: string): EmailContent {
  const html = emailLayout({
    preheader: "Votre mot de passe a été modifié.",
    heading: "Votre mot de passe a été modifié",
    bodyHtml: `<p style="margin:0 0 12px;">Bonjour ${name || ""},</p>
      <p style="margin:0 0 12px;">Le mot de passe de votre compte Callpme vient d'être modifié avec succès.</p>
      <p style="margin:0;">Si vous n'êtes pas à l'origine de ce changement, sécurisez votre compte immédiatement et contactez-nous.</p>`,
    ctaLabel: "Accéder à mon espace",
    ctaUrl: `${baseUrl()}/overview`,
  });
  return { subject: "Sécurité — mot de passe modifié", html, text: toText(html) };
}

/* ---------------------------- Abonnement --------------------------------- */

export function subscriptionEmail(
  name: string,
  planName: string,
): EmailContent {
  const html = emailLayout({
    preheader: `Votre offre est désormais ${planName}.`,
    heading: `Votre offre est désormais ${planName}`,
    bodyHtml: `<p style="margin:0 0 12px;">Bonjour ${name || ""},</p>
      <p style="margin:0 0 12px;">Votre abonnement Callpme a été mis à jour sur l'offre <strong>${planName}</strong>. Les nouvelles limites et fonctionnalités sont actives immédiatement.</p>
      <p style="margin:0;">Merci de votre confiance.</p>`,
    ctaLabel: "Voir mon offre",
    ctaUrl: `${baseUrl()}/billing`,
  });
  return {
    subject: `Votre offre Callpme : ${planName}`,
    html,
    text: toText(html),
  };
}

/* ------------------------------- Promo ----------------------------------- */

export function promoEmail(code: string, detail: string): EmailContent {
  const html = emailLayout({
    preheader: `Votre code promo : ${code}`,
    heading: "Une offre rien que pour vous",
    bodyHtml: `<p style="margin:0 0 12px;">Profitez de votre avantage Callpme avec le code ci-dessous :</p>
      <div style="margin:8px 0 14px;padding:14px;border:1px dashed #E8572A;border-radius:10px;text-align:center;">
        <span style="font-family:ui-monospace,Menlo,monospace;font-size:20px;font-weight:700;letter-spacing:2px;color:#E8572A;">${code}</span>
      </div>
      <p style="margin:0;">${detail}</p>`,
    ctaLabel: "En profiter",
    ctaUrl: `${baseUrl()}/billing`,
  });
  return { subject: `Votre code promo Callpme : ${code}`, html, text: toText(html) };
}

/* --------------------------- Annonce libre ------------------------------- */

export function announcementEmail(
  subject: string,
  message: string,
): EmailContent {
  const html = emailLayout({
    preheader: subject,
    heading: subject,
    bodyHtml: message
      .split(/\n{2,}/)
      .map((p) => `<p style="margin:0 0 12px;">${p.replace(/\n/g, "<br/>")}</p>`)
      .join(""),
    ctaLabel: "Ouvrir Callpme",
    ctaUrl: `${baseUrl()}/overview`,
  });
  return { subject, html, text: toText(html) };
}

/* ------------------------- Équipe et sécurité ---------------------------- */

/** Échappe le texte saisi par les utilisateurs avant de l'insérer dans un e-mail HTML. */
export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c);
}

export function invitationEmail(opts: { inviterName: string; orgName: string; role: string; link: string }): EmailContent {
  const inviterName = opts.inviterName.slice(0, 80);
  const inviter = escapeHtml(inviterName || "Un membre de l'équipe");
  const org = escapeHtml(opts.orgName);
  const role = opts.role === "admin" ? "administrateur" : opts.role === "client" ? "client (espace de suivi de vos appels)" : "membre";
  const html = emailLayout({
    preheader: `${inviterName || "Votre équipe"} vous invite sur Callpme.`,
    heading: `Rejoignez ${org} sur Callpme`,
    bodyHtml: `<p style="margin:0 0 12px;">Bonjour,</p>
      <p style="margin:0 0 12px;">${inviter} vous invite à rejoindre l'espace <strong>${org}</strong> en tant que ${role}.</p>
      <p style="margin:0;">Le lien est valable 7 jours et ne sert qu'une fois.</p>`,
    ctaLabel: "Accepter l'invitation",
    ctaUrl: opts.link,
    footnote: "Vous ne connaissez pas cette personne ? Ignorez simplement cet e-mail.",
  });
  const orgPlain = opts.orgName.replace(/[\r\n]+/g, " ").slice(0, 80);
  return { subject: `Invitation à rejoindre ${orgPlain} sur Callpme`, html, text: toText(html) };
}

export function twoFactorEmail(name: string, enabled: boolean): EmailContent {
  const who = escapeHtml(name || "");
  const html = emailLayout({
    preheader: enabled ? "La double authentification est activée." : "La double authentification est désactivée.",
    heading: enabled ? "Double authentification activée" : "Double authentification désactivée",
    bodyHtml: `<p style="margin:0 0 12px;">Bonjour ${who},</p>
      <p style="margin:0 0 12px;">${
        enabled
          ? "Votre compte Callpme demande désormais un code de votre application d'authentification à chaque connexion. Gardez vos codes de secours en lieu sûr."
          : "Votre compte Callpme ne demande plus de code à la connexion."
      }</p>
      <p style="margin:0;">Si vous n'êtes pas à l'origine de ce changement, changez votre mot de passe immédiatement et contactez-nous.</p>`,
    ctaLabel: "Vérifier mes réglages",
    ctaUrl: `${baseUrl()}/settings#securite`,
  });
  return { subject: enabled ? "Sécurité — double authentification activée" : "Sécurité — double authentification désactivée", html, text: toText(html) };
}
