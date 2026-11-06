import { NextRequest, NextResponse } from "next/server";
import { getSession, isOrgAdmin } from "@/lib/auth/session";
import { connectIntegration } from "@/lib/db/integrations";
import { exchangeCode, verifyOAuthState } from "@/lib/integrations/google-calendar";

export const dynamic = "force-dynamic";

/** GET /api/integrations/google/callback — retour de Google après consentement. */
export async function GET(req: NextRequest) {
  const base = (process.env.PUBLIC_URL || "http://localhost:3000").replace(/\/$/, "");
  const fail = NextResponse.redirect(`${base}/integrations?error=google_calendar`);
  fail.cookies.delete("gcal_nonce");

  const session = await getSession();
  const orgId = verifyOAuthState(req.nextUrl.searchParams.get("state"), req.cookies.get("gcal_nonce")?.value);
  const code = req.nextUrl.searchParams.get("code");
  // L'état doit correspondre à l'organisation de la session en cours.
  if (!session || !isOrgAdmin(session) || !orgId || orgId !== session.org.id || !code) return fail;

  try {
    const tokens = await exchangeCode(code);
    if (!tokens) return fail;
    await connectIntegration(session.org.id, "google_calendar", {
      accountName: tokens.email,
      credentials: { refresh_token: tokens.refreshToken, calendar_id: "primary" },
    });
    const ok = NextResponse.redirect(`${base}/integrations?connected=google_calendar`);
    ok.cookies.delete("gcal_nonce");
    return ok;
  } catch {
    return fail;
  }
}
