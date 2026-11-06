/**
 * Middleware — défense en profondeur : toute route applicative est privée par
 * défaut. Il ne vérifie que la PRÉSENCE du cookie de session (l'Edge runtime
 * n'accède pas à Prisma) ; la validation réelle de la session et le
 * cloisonnement par organisation restent faits par chaque layout / handler
 * (requireSession, requireOwnedAgent…). Une nouvelle route oubliée n'est donc
 * plus publique par accident.
 */
import { NextResponse, type NextRequest } from "next/server";
import { PORTAL_COOKIE_NAME } from "@/lib/auth/cookie-names";

const SESSION_COOKIE = "cpme_session";

/** Routes API accessibles sans session (auth propre ou appel serveur-à-serveur). */
const PUBLIC_API_PREFIXES = [
  "/api/auth/", // OAuth Google (state vérifié)
  "/api/v1/", // API publique : clé d'API
  "/api/telephony/inbound", // signature de l'opérateur (Twilio / Telnyx)
  "/api/telephony/texml", // jeton signé Callpme (ancien chemin)
  "/api/telephony/answer", // jeton signé Callpme
  "/api/telephony/sip/", // passerelle Asterisk : secret SIP_GATEWAY_SECRET
  "/api/cron/campaigns", // secret CRON_SECRET (en-tête Authorization)
  "/api/telephony/status", // signature de l'opérateur (Twilio / Telnyx)
  "/api/payments/geniuspay/webhook", // revérifié auprès de GeniusPay
  "/api/widget/", // widget site web : domaines autorisés (Origin) + limites
  "/api/whatsapp/webhook/", // Meta : signature X-Hub-Signature-256 vérifiée
];

/** Pages applicatives réservées aux utilisateurs connectés. */
const PRIVATE_PAGE_PREFIXES = [
  "/overview",
  "/start",
  "/conversations",
  "/channels",
  "/facture",
  "/agents",
  "/analytics",
  "/billing",
  "/calls",
  "/campaigns",
  "/clients",
  "/developers",
  "/integrations",
  "/knowledge",
  "/numbers",
  "/settings",
  "/templates",
  "/voices",
  // "/admin" volontairement absent : son layout renvoie 404 sans session
  // (espace invisible) ; une redirection vers /login révélerait son existence.
];

function matches(path: string, prefix: string) {
  return prefix.endsWith("/")
    ? path.startsWith(prefix)
    : path === prefix || path.startsWith(prefix + "/");
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  // Portail des clients d'agence : cookie distinct.
  if (matches(pathname, "/espace") && !req.cookies.get(PORTAL_COOKIE_NAME)?.value) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  const hasSession = Boolean(req.cookies.get(SESSION_COOKIE)?.value);
  if (hasSession) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    if (PUBLIC_API_PREFIXES.some((p) => matches(pathname, p))) {
      return NextResponse.next();
    }
    return NextResponse.json(
      { error: "Authentification requise" },
      { status: 401 },
    );
  }

  if (PRIVATE_PAGE_PREFIXES.some((p) => matches(pathname, p))) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Exclut les fichiers statiques et assets Next.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|ico|woff2?|mp3|wav)$).*)"],
};
