import { afterEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "crypto";
import { verifyInternal } from "@/lib/integrations/internal-bridge";

const env = { ...process.env };
afterEach(() => {
  process.env = { ...env };
});

describe("liaison interne serveur vocal → site", () => {
  it("accepte une requête signée récente, refuse le reste", () => {
    process.env.NEXTAUTH_SECRET = "x".repeat(40);
    const body = JSON.stringify({ op: "busy", orgId: "o1" });
    const ts = String(Date.now());
    const sig = createHmac("sha256", `internal-bridge:${"x".repeat(40)}`).update(`${ts}.${body}`).digest("hex");
    expect(verifyInternal(ts, sig, body)).toBe(true);
    expect(verifyInternal(ts, sig, body.replace("o1", "o2"))).toBe(false); // corps modifié
    expect(verifyInternal(String(Date.now() - 10 * 60_000), sig, body)).toBe(false); // trop ancien
    expect(verifyInternal(ts, "0".repeat(64), body)).toBe(false);
    expect(verifyInternal(null, sig, body)).toBe(false);
  });
});
