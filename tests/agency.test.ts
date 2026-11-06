import { describe, expect, it } from "vitest";
import { domainToken, isPlatformDomain, txtRecordName } from "@/lib/agency/domain";
import { PORTAL_COOKIE_NAME, SESSION_COOKIE_NAME } from "@/lib/auth/cookie-names";

describe("marque blanche : domaine de l'agence", () => {
  it("refuse les domaines de la plateforme, leurs sous-domaines et leurs parents", () => {
    const hosts = ["www.callpme.com"];
    expect(isPlatformDomain("callpme.com", hosts)).toBe(true);
    expect(isPlatformDomain("espace.callpme.com", hosts)).toBe(true);
    expect(isPlatformDomain("monagence.vercel.app", hosts)).toBe(true);
    expect(isPlatformDomain("espace.monagence.bj", hosts)).toBe(false);
  });

  it("jeton DNS propre à l'organisation et au domaine", () => {
    expect(domainToken("org1", "a.bj")).toMatch(/^callpme-verify=[a-f0-9]{32}$/);
    expect(domainToken("org1", "a.bj")).toBe(domainToken("org1", "a.bj"));
    expect(domainToken("org1", "a.bj")).not.toBe(domainToken("org2", "a.bj"));
    expect(txtRecordName("espace.monagence.bj")).toBe("_callpme.espace.monagence.bj");
  });

  it("le portail a son propre cookie, distinct du filtre « client actif » (cpme_client)", () => {
    expect(PORTAL_COOKIE_NAME).not.toBe("cpme_client");
    expect(PORTAL_COOKIE_NAME).not.toBe(SESSION_COOKIE_NAME);
  });
});
