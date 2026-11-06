import { describe, expect, it } from "vitest";
import { isBlockedIp, fetchPublicText, UnsafeUrlError } from "@/lib/net/safe-fetch";
import { checkDestination } from "@/lib/telephony/destinations";
import { decryptSecret, encryptSecret, isEncrypted } from "@/lib/crypto/secrets";

describe("isBlockedIp (protection SSRF)", () => {
  it.each([
    "127.0.0.1",
    "10.1.2.3",
    "172.16.5.4",
    "192.168.1.1",
    "169.254.169.254",
    "100.64.0.1",
    "0.0.0.0",
    "::1",
    "::",
    "fe80::1",
    "fd12:3456::1",
    "ff02::1",
    "::ffff:127.0.0.1",
    "::ffff:7f00:1",
    "::ffff:a9fe:a9fe",
    "::7f00:1",
    "64:ff9b::a9fe:a9fe",
    "2002:7f00:1::",
    "2001:db8::1",
  ])("bloque %s", (ip) => {
    expect(isBlockedIp(ip)).toBe(true);
  });

  it.each(["8.8.8.8", "93.184.216.34", "2606:4700:4700::1111", "64:ff9b::808:808"])("autorise %s", (ip) => {
    expect(isBlockedIp(ip)).toBe(false);
  });

  it("refuse les schémas, ports et adresses non publics sans requête réseau", async () => {
    for (const url of ["file:///etc/passwd", "http://127.0.0.1/", "http://example.com:8080/", "http://[::1]/", "http://user:pw@example.com/"]) {
      await expect(fetchPublicText(url)).rejects.toBeInstanceOf(UnsafeUrlError);
    }
  });
});

describe("checkDestination (appels sortants)", () => {
  it.each(["+33 6 12 34 56 78", "+32 470 12 34 56", "+225 07 12 34 56 78", "+221 77 123 45 67"])("autorise %s", (n) => {
    expect(checkDestination(n).ok).toBe(true);
  });

  it("refuse les numéros surtaxés", () => {
    expect(checkDestination("+33 8 99 12 34 56").ok).toBe(false);
    expect(checkDestination("+1 900 555 0100").ok).toBe(false);
  });

  it("refuse les pays non couverts et les formats nationaux", () => {
    expect(checkDestination("+44 20 7946 0958").ok).toBe(false);
    expect(checkDestination("0612345678").ok).toBe(false);
  });
});

describe("chiffrement des identifiants", () => {
  it("chiffre puis déchiffre", () => {
    const enc = encryptSecret("AC-secret-123");
    expect(enc).not.toBeNull();
    expect(isEncrypted(enc)).toBe(true);
    expect(enc).not.toContain("AC-secret-123");
    expect(decryptSecret(enc)).toBe("AC-secret-123");
  });

  it("utilise un IV aléatoire et ne rechiffre pas une valeur déjà chiffrée", () => {
    const a = encryptSecret("x")!;
    const b = encryptSecret("x")!;
    expect(a).not.toBe(b);
    expect(encryptSecret(a)).toBe(a);
  });

  it("relit les valeurs héritées en clair et ignore les vides", () => {
    expect(decryptSecret("legacy-plain")).toBe("legacy-plain");
    expect(encryptSecret("")).toBeNull();
    expect(decryptSecret(null)).toBeNull();
  });

  it("rejette une valeur altérée", () => {
    const enc = encryptSecret("secret")!;
    const tampered = enc.slice(0, -4) + (enc.endsWith("AAAA") ? "BBBB" : "AAAA");
    expect(() => decryptSecret(tampered)).toThrow();
  });
});
