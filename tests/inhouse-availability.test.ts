import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Une voix maison ne parle au téléphone que si sa version est publiée, le
 * consentement non révoqué ET l'entrée du catalogue active.
 */
const db = vi.hoisted(() => ({
  versions: [] as { modelRef: string; status: string; revoked: boolean; platformVoiceId: string | null }[],
  catalog: [] as { id: string; provider: string; active: boolean }[],
}));

vi.mock("@/lib/db/client", () => ({
  prisma: {
    inhouseVoiceVersion: {
      findFirst: async ({ where }: { where: { modelRef: string; status: string; voice: { consent: { is: { revokedAt: null } } } } }) => {
        const v = db.versions.find((x) => x.modelRef === where.modelRef && x.status === where.status && !x.revoked);
        expect(where.voice.consent.is.revokedAt).toBeNull(); // le filtre de consentement est bien demandé
        return v ? { platformVoiceId: v.platformVoiceId } : null;
      },
    },
    platformVoice: {
      findFirst: async ({ where }: { where: { id: string; provider: string; active: boolean } }) =>
        db.catalog.find((p) => p.id === where.id && p.provider === where.provider && p.active === where.active) ?? null,
    },
  },
}));

import { inhouseVoiceAvailable } from "@/lib/voices/platform";

beforeEach(() => {
  db.versions = [{ modelRef: "cpm_awa", status: "published", revoked: false, platformVoiceId: "pv_awa" }];
  db.catalog = [{ id: "pv_awa", provider: "callpme", active: true }];
});

describe("disponibilité d'une voix maison au téléphone", () => {
  it("publiée, consentement valide, catalogue actif : disponible", async () => {
    expect(await inhouseVoiceAvailable("cpm_awa")).toBe(true);
  });

  it("consentement révoqué : coupée même si le catalogue a été réactivé à la main", async () => {
    db.versions[0].revoked = true;
    expect(await inhouseVoiceAvailable("cpm_awa")).toBe(false);
  });

  it("version retirée : coupée", async () => {
    db.versions[0].status = "retired";
    expect(await inhouseVoiceAvailable("cpm_awa")).toBe(false);
  });

  it("désactivée au catalogue : coupée", async () => {
    db.catalog[0].active = false;
    expect(await inhouseVoiceAvailable("cpm_awa")).toBe(false);
  });

  it("identifiant absent ou inconnu : coupée", async () => {
    expect(await inhouseVoiceAvailable(undefined)).toBe(false);
    expect(await inhouseVoiceAvailable("cpm_inconnu")).toBe(false);
  });
});
