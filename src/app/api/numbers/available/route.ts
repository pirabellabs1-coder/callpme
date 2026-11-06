import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { countryInfo, NumberError, searchNumbers } from "@/lib/telephony/numbers";
import { isRateLimited } from "@/lib/security/rate-limit";
import { ok, badRequest, unauthorized, serverError, tooMany } from "@/lib/api/respond";

export const dynamic = "force-dynamic";

/** GET /api/numbers/available?country=FR&type=local&contains=184 — numéros à acheter. */
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return unauthorized();
    if (isRateLimited(`numsearch:${session.org.id}`, 30, 60_000)) return tooMany("Trop de recherches, patientez une minute.");
    const country = (req.nextUrl.searchParams.get("country") ?? "FR").toUpperCase();
    const type = req.nextUrl.searchParams.get("type") ?? "local";
    if (type !== "local" && type !== "mobile" && type !== "tollfree") return badRequest("Type de numéro invalide.");
    const info = countryInfo(country);
    if (!info) return badRequest("Pays non proposé.");
    const numbers = await searchNumbers({ country, type, contains: req.nextUrl.searchParams.get("contains") ?? undefined });
    return ok({ numbers, monthlyEur: info.monthlyEur });
  } catch (e) {
    if (e instanceof NumberError) return badRequest(e.message);
    return serverError();
  }
}
