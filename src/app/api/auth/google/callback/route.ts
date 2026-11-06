import { NextRequest, NextResponse } from "next/server";
import { CHALLENGE_COOKIE, challengeCookieOptions, makeChallenge } from "@/lib/auth/two-factor";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/db/client";
import { hashPassword } from "@/lib/auth/password";
import { CLIENT_COOKIE, createSession, SESSION_COOKIE } from "@/lib/auth/session";
import { sendEmail } from "@/lib/email/resend";
import { welcomeEmail } from "@/lib/email/templates";

export const dynamic = "force-dynamic";

const MAX_AGE = 60 * 60 * 24 * 30;

/** Callback Google : échange le code, crée/retrouve l'utilisateur, ouvre la session. */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const base = process.env.PUBLIC_URL || url.origin;
  const fail = NextResponse.redirect(`${base}/login?error=google`);

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = req.cookies.get("g_state")?.value;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!code || !clientId || !clientSecret || !state || state !== cookieState) {
    return fail;
  }

  try {
    // 1) Échange du code contre des jetons
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: `${base}/api/auth/google/callback`,
        grant_type: "authorization_code",
      }),
      signal: AbortSignal.timeout(10000),
    });
    const tokens = await tokenRes.json();
    if (!tokens.access_token) return fail;

    // 2) Profil utilisateur
    const profRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
      signal: AbortSignal.timeout(10000),
    });
    const profile = await profRes.json();
    const email = String(profile.email || "").toLowerCase().trim();
    // Seule une adresse vérifiée par Google peut ouvrir (ou créer) un compte à ce nom.
    if (!email || profile.verified_email !== true) return fail;

    // 3) Retrouve ou crée le compte (+ organisation pour un nouveau compte)
    let user = await prisma.user.findUnique({ where: { email } });
    const isNew = !user;
    if (!user) {
      const name = String(profile.name || email.split("@")[0]);
      const passwordHash = await hashPassword(randomBytes(24).toString("hex"));
      const org = await prisma.organization.create({
        data: {
          name: `${name} — Espace`,
          plan: "starter",
          users: { create: { email, name, passwordHash, role: "owner" } },
        },
        include: { users: true },
      });
      user = org.users[0];
      const wel = welcomeEmail(name, org.name);
      void sendEmail({ to: email, subject: wel.subject, html: wel.html, text: wel.text }).catch(() => {});
    }

    // 4) Double authentification active : le code est demandé avant toute session.
    if (user.twoFactorEnabled) {
      const res = NextResponse.redirect(`${base}/login?step=2fa`);
      res.cookies.set(CHALLENGE_COOKIE, makeChallenge(user.id), challengeCookieOptions);
      res.cookies.delete("g_state");
      return res;
    }

    // 5) Session (accès client d'agence : portail uniquement)
    const token = await createSession(user.id);
    if (user.clientId) {
      const res = NextResponse.redirect(`${base}/espace`);
      res.cookies.set(CLIENT_COOKIE, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: MAX_AGE,
      });
      res.cookies.delete("g_state");
      return res;
    }
    // Nouveau compte : le parcours guidé de démarrage ; sinon le tableau de bord.
    const res = NextResponse.redirect(`${base}${isNew ? "/start" : "/overview"}`);
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: MAX_AGE,
    });
    res.cookies.delete("g_state");
    return res;
  } catch {
    return fail;
  }
}
