import { describe, expect, it } from "vitest";
import { normalizeDomain, originAllowed, widgetSchema, widgetSnippet } from "@/lib/widget/widget";

describe("widget : domaines autorisés", () => {
  it("normalise ce que l'utilisateur colle", () => {
    expect(normalizeDomain("https://www.Exemple.bj/contact?x=1")).toBe("www.exemple.bj");
    expect(normalizeDomain("exemple.bj:443")).toBe("exemple.bj");
    expect(normalizeDomain("localhost")).toBe("localhost");
    expect(normalizeDomain("pas un domaine")).toBeNull();
    expect(normalizeDomain("javascript:alert(1)")).toBeNull();
  });

  it("autorise le domaine et ses sous-domaines, en https seulement", () => {
    const d = ["exemple.bj"];
    expect(originAllowed("https://exemple.bj", d)).toBe(true);
    expect(originAllowed("https://www.exemple.bj", d)).toBe(true);
    expect(originAllowed("http://exemple.bj", d)).toBe(false);
    expect(originAllowed("https://exemple.bj.pirate.com", d)).toBe(false);
    expect(originAllowed("https://fauxexemple.bj", d)).toBe(false);
    expect(originAllowed(null, d)).toBe(false);
    expect(originAllowed("http://localhost:5173", ["localhost"])).toBe(true);
  });

  it("le schéma refuse un domaine invalide et normalise les autres", () => {
    expect(widgetSchema.safeParse({ enabled: true, allowedDomains: ["<script>"] }).success).toBe(false);
    const ok = widgetSchema.parse({ enabled: true, allowedDomains: ["https://Monsite.bj/"], color: "#112233" });
    expect(ok.allowedDomains).toEqual(["monsite.bj"]);
    expect(widgetSchema.safeParse({ enabled: true, allowedDomains: [], color: "red" }).success).toBe(false);
  });

  it("code à coller", () => {
    expect(widgetSnippet("https://app.callpme.com/", "abc123")).toBe(
      '<script src="https://app.callpme.com/widget.js" data-agent="abc123" async></script>',
    );
  });
});
