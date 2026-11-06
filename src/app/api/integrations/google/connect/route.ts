import { NextResponse } from "next/server";
import { getSession, isOrgAdmin } from "@/lib/auth/session";
import { createOAuthState, GOOGLE_CALENDAR_SCOPES, googleCalendarAvailable, redirectUri } from "@/lib/integrations/google-calendar";

export const dynamic = "force-dynamic";

/** GET /api/integrations/google/connect — démarre la connexion à Google Agenda. */
export async function GET() {
  const base = (process.env.PUBLIC_URL || "http://localhost:3000").replace(/\/$/, "");
  const session = await getSession();
  if (!session) return NextResponse.redirect(`${base}/login`);
  if (!isOrgAdmin(session) || !googleCalendarAvailable()) {
    return NextResponse.redirect(`${base}/integrations?error=google_calendar`);
  }
  const { state, nonce } = createOAuthState(session.org.id);
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: GOOGLE_CALENDAR_SCOPES.join(" "),
    state,
    // Jeton de rafraîchissement : nécessaire pour agir pendant les appels.
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
  });
  const res = NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
  res.cookies.set("gcal_nonce", nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/integrations/google",
    maxAge: 600,
  });
  return res;
}
