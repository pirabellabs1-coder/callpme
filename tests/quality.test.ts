import { describe, expect, it } from "vitest";
import { parseQuality, QualityTracker, SLOW_RESPONSE_MS } from "@/lib/voice-engine/quality";

function clock() {
  let t = 0;
  return { now: () => t, advance: (ms: number) => (t += ms) };
}

describe("qualité technique d'un appel", () => {
  it("mesure le temps de réponse perçu, le modèle et la voix", () => {
    const c = clock();
    const q = new QualityTracker(c.now);
    q.turnStart();
    c.advance(600);
    q.llmFirstToken();
    c.advance(400);
    q.firstAudio();
    c.advance(2000);
    q.firstAudio(); // la suite de l'audio ne compte pas
    q.turnEnd();
    const s = q.summary();
    expect(s.turns).toBe(1);
    expect(s.responseAvgMs).toBe(1000);
    expect(s.llmAvgMs).toBe(600);
    expect(s.ttsAvgMs).toBe(400);
    expect(s.issues).toEqual([]);
  });

  it("signale des réponses lentes", () => {
    const c = clock();
    const q = new QualityTracker(c.now);
    for (let i = 0; i < 3; i++) {
      q.turnStart();
      c.advance(SLOW_RESPONSE_MS + 500);
      q.firstAudio();
      q.turnEnd();
    }
    const s = q.summary();
    expect(s.responseAvgMs).toBe(SLOW_RESPONSE_MS + 500);
    expect(s.issues[0]).toMatch(/Réponses lentes/);
  });

  it("signale un long blanc isolé même si la moyenne est bonne", () => {
    const c = clock();
    const q = new QualityTracker(c.now);
    const delays = [500, 600, 700, 500, 6000];
    for (const d of delays) {
      q.turnStart();
      c.advance(d);
      q.firstAudio();
      q.turnEnd();
    }
    const s = q.summary();
    expect(s.responseP95Ms).toBe(6000);
    expect(s.issues.some((i) => /long blanc/.test(i))).toBe(true);
  });

  it("compte les pannes et les interruptions fréquentes", () => {
    const c = clock();
    const q = new QualityTracker(c.now);
    for (let i = 0; i < 4; i++) {
      q.turnStart();
      c.advance(800);
      q.firstAudio();
      q.interrupted();
      q.turnEnd();
    }
    q.llmError();
    q.ttsError();
    const s = q.summary();
    expect(s.interruptions).toBe(4);
    expect(s.issues).toEqual(
      expect.arrayContaining([expect.stringMatching(/modèle/), expect.stringMatching(/voix/), expect.stringMatching(/coupe souvent/)]),
    );
  });

  it("ignore un tour sans réponse audible dans les moyennes", () => {
    const c = clock();
    const q = new QualityTracker(c.now);
    q.turnStart();
    c.advance(5000);
    q.turnEnd();
    const s = q.summary();
    expect(s.turns).toBe(0);
    expect(s.responseAvgMs).toBeNull();
  });

  it("lit la colonne JSON de façon tolérante", () => {
    expect(parseQuality(null)).toBeNull();
    expect(parseQuality("pas du json")).toBeNull();
    expect(parseQuality('{"x":1}')).toBeNull();
    const q = new QualityTracker().summary();
    expect(parseQuality(JSON.stringify(q))).toEqual(q);
  });
});
