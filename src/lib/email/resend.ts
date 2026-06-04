/**
 * Envoi d'e-mails transactionnels via Resend (API REST, sans SDK).
 * La clé `RESEND_API_KEY` et l'expéditeur `RESEND_FROM` viennent de l'env.
 */

export function hasResend(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export interface SendEmailResult {
  ok: boolean;
  id?: string;
  error?: string;
}

export async function sendEmail(opts: {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}): Promise<SendEmailResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, error: "Clé Resend absente (RESEND_API_KEY)." };
  const from = process.env.RESEND_FROM || "Callpme <onboarding@resend.dev>";

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: Array.isArray(opts.to) ? opts.to : [opts.to],
        subject: opts.subject,
        html: opts.html,
        ...(opts.text ? { text: opts.text } : {}),
      }),
      signal: AbortSignal.timeout(15000),
    });
    const data = (await res.json().catch(() => ({}))) as {
      id?: string;
      message?: string;
      name?: string;
    };
    if (!res.ok) {
      return { ok: false, error: data?.message ?? `Resend HTTP ${res.status}` };
    }
    return { ok: true, id: data?.id };
  } catch {
    return { ok: false, error: "Envoi impossible (réseau / délai dépassé)." };
  }
}

/** Habillage HTML d'un e-mail aux couleurs Callpme. */
export function brandedEmail(title: string, bodyHtml: string): string {
  return `<!doctype html><html lang="fr"><body style="margin:0;background:#faf7f5;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1c1917;">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px;">
    <div style="display:inline-flex;align-items:center;gap:8px;margin-bottom:24px;">
      <span style="display:inline-block;width:28px;height:28px;border-radius:8px;background:#E8572A;"></span>
      <span style="font-size:18px;font-weight:700;color:#1c1917;">Callpme</span>
    </div>
    <div style="background:#ffffff;border:1px solid #ece7e3;border-radius:16px;padding:28px;">
      <h1 style="margin:0 0 12px;font-size:20px;line-height:1.3;color:#1c1917;">${title}</h1>
      <div style="font-size:15px;line-height:1.6;color:#44403c;">${bodyHtml}</div>
    </div>
    <p style="margin-top:20px;font-size:12px;color:#a8a29e;text-align:center;">Callpme — agents vocaux IA · Cet e-mail vous est envoyé depuis votre plateforme.</p>
  </div></body></html>`;
}
