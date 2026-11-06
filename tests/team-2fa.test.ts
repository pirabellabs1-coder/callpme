import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/client", () => ({ prisma: {} }));
vi.mock("next/headers", () => ({ cookies: () => ({ get: () => undefined, set: () => {}, delete: () => {} }) }));

import {
  base32Decode,
  base32Encode,
  consumeBackupCode,
  generateBackupCodes,
  generateTotpSecret,
  otpauthUri,
  totpAt,
  verifyTotp,
} from "@/lib/auth/totp";
import { lockDurationMs, makeChallenge, readChallenge } from "@/lib/auth/two-factor";
import { canGrant, canManage } from "@/lib/team/roles";
import { hashInviteToken, newInviteToken } from "@/lib/team/invitations";
import { escapeHtml, invitationEmail } from "@/lib/email/templates";

// Vecteurs de test officiels (RFC 6238, SHA-1), tronqués à 6 chiffres.
const RFC_SECRET = base32Encode(Buffer.from("12345678901234567890"));

describe("TOTP (RFC 6238)", () => {
  it("donne les codes des vecteurs officiels", () => {
    expect(totpAt(RFC_SECRET, Math.floor(59 / 30))).toBe("287082");
    expect(totpAt(RFC_SECRET, Math.floor(1111111109 / 30))).toBe("081804");
    expect(totpAt(RFC_SECRET, Math.floor(1234567890 / 30))).toBe("005924");
    expect(totpAt(RFC_SECRET, Math.floor(2000000000 / 30))).toBe("279037");
  });

  it("base32 aller-retour", () => {
    const secret = generateTotpSecret();
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(base32Encode(base32Decode(secret))).toBe(secret);
  });

  it("accepte le code courant et voisin, refuse la réutilisation et les codes anciens", () => {
    const now = 1_700_000_000_000;
    const step = Math.floor(now / 30000);
    const code = totpAt(RFC_SECRET, step);
    expect(verifyTotp(RFC_SECRET, code, null, now)).toBe(step);
    expect(verifyTotp(RFC_SECRET, code.slice(0, 3) + " " + code.slice(3), null, now)).toBe(step);
    expect(verifyTotp(RFC_SECRET, totpAt(RFC_SECRET, step - 1), null, now)).toBe(step - 1);
    // Déjà utilisé : refusé.
    expect(verifyTotp(RFC_SECRET, code, step, now)).toBeNull();
    // Trop ancien (3 pas = 90 s).
    expect(verifyTotp(RFC_SECRET, totpAt(RFC_SECRET, step - 3), null, now)).toBeNull();
    expect(verifyTotp(RFC_SECRET, "12345", null, now)).toBeNull();
  });

  it("adresse otpauth pour le QR code", () => {
    const uri = otpauthUri("ABCD", "awa@cabinet.ci");
    expect(uri).toBe("otpauth://totp/Callpme%3Aawa%40cabinet.ci?secret=ABCD&issuer=Callpme&algorithm=SHA1&digits=6&period=30");
  });
});

describe("codes de secours", () => {
  it("10 codes uniques, utilisables une seule fois, insensibles à la casse et au tiret", () => {
    const { codes, hashes } = generateBackupCodes();
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    expect(codes[0]).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    const stored = JSON.stringify(hashes);
    const left = consumeBackupCode(stored, codes[3].toLowerCase().replace("-", ""));
    expect(left).toHaveLength(9);
    expect(consumeBackupCode(JSON.stringify(left), codes[3])).toBeNull();
    expect(consumeBackupCode(stored, "AAAA-AAAA")).toBeNull();
  });
});

describe("défi de connexion signé", () => {
  it("valide 5 minutes, infalsifiable", () => {
    const now = Date.now();
    const c = makeChallenge("user_1", now);
    expect(readChallenge(c, now + 60_000)).toBe("user_1");
    expect(readChallenge(c, now + 6 * 60_000)).toBeNull();
    expect(readChallenge(c.replace("user_1", "user_2"), now)).toBeNull();
    expect(readChallenge(`${c}x`, now)).toBeNull();
    expect(readChallenge(undefined, now)).toBeNull();
  });
});

describe("équipe : droits", () => {
  const owner = { id: "o", role: "owner" };
  const admin = { id: "a", role: "admin" };
  const admin2 = { id: "a2", role: "admin" };
  const member = { id: "m", role: "member" };

  it("le propriétaire gère tout le monde sauf lui-même", () => {
    expect(canManage(owner, admin)).toBe(true);
    expect(canManage(owner, member)).toBe(true);
    expect(canManage(owner, owner)).toBe(false);
  });

  it("un admin gère les membres seulement, jamais le propriétaire ni un autre admin", () => {
    expect(canManage(admin, member)).toBe(true);
    expect(canManage(admin, admin2)).toBe(false);
    expect(canManage(admin, owner)).toBe(false);
    expect(canManage(member, member)).toBe(false);
  });

  it("seul le propriétaire nomme des admins ; personne ne nomme un propriétaire", () => {
    expect(canGrant("owner", "admin")).toBe(true);
    expect(canGrant("admin", "admin")).toBe(false);
    expect(canGrant("admin", "member")).toBe(true);
    expect(canGrant("member", "member")).toBe(false);
    expect(canGrant("owner", "owner")).toBe(false);
  });
});

describe("invitations", () => {
  it("jeton long et aléatoire, seule son empreinte est stockée", () => {
    const a = newInviteToken();
    const b = newInviteToken();
    expect(a.token).not.toBe(b.token);
    expect(a.token.length).toBeGreaterThanOrEqual(40);
    expect(a.tokenHash).toBe(hashInviteToken(a.token));
    expect(a.tokenHash).not.toContain(a.token);
  });

  it("l'e-mail d'invitation échappe les noms saisis", () => {
    expect(escapeHtml(`<img src=x onerror="a">`)).toBe("&lt;img src=x onerror=&quot;a&quot;&gt;");
    const mail = invitationEmail({ inviterName: "<b>Pirate</b>", orgName: "Cabinet <script>", role: "member", link: "https://x/invitation/t" });
    expect(mail.html).not.toContain("<script>");
    expect(mail.html).toContain("&lt;b&gt;Pirate&lt;/b&gt;");
  });
});

describe("verrouillage après codes erronés", () => {
  it("bloque après chaque série de 5 échecs, durée doublée, 24 h au plus", () => {
    expect(lockDurationMs(4)).toBe(0);
    expect(lockDurationMs(5)).toBe(15 * 60_000);
    expect(lockDurationMs(6)).toBe(0);
    expect(lockDurationMs(10)).toBe(30 * 60_000);
    expect(lockDurationMs(15)).toBe(60 * 60_000);
    expect(lockDurationMs(100)).toBe(24 * 60 * 60_000);
  });
});
