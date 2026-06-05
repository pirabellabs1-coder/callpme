import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";

export const dynamic = "force-dynamic";

/** Démarre la connexion Google : redirige vers l'écran de consentement. */
export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const base = process.env.PUBLIC_URL || new URL(req.url).origin;
  if (!clientId) {
    // Google non configuré (variables d'env manquantes) — retour propre.
    return NextResponse.redirect(`${base}/login?error=google`);
  }
  const redirectUri = `${base}/api/auth/google/callback`;
  const state = randomBytes(16).toString("hex");
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
    access_type: "online",
  });
  const res = NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
  );
  res.cookies.set("g_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return res;
}
