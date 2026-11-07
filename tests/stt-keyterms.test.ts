import { describe, expect, it } from "vitest";
import { cleanKeyterms } from "@/lib/voice-engine/stt";
import { addDays, mondayOf } from "@/lib/agenda/calendar-dates";

describe("mots-clés de transcription", () => {
  it("garde accents et alphabets étendus, dédoublonne, plafonne à 20", () => {
    expect(cleanKeyterms(["Hɔnmɛ", "Cabinet Médical", "Cabinet Médical", "x", null, "Ŋgɔ"])).toEqual(["Hɔnmɛ", "Cabinet Médical", "Ŋgɔ"]);
    expect(cleanKeyterms(Array.from({ length: 30 }, (_, i) => `Mot${i}`))).toHaveLength(20);
    expect(cleanKeyterms(["<script>Dossou</script>"])).toEqual(["script Dossou script"]);
  });
});

describe("dates du calendrier", () => {
  it("lundi de la semaine et changements de mois / d'année", () => {
    expect(mondayOf("2026-11-08")).toBe("2026-11-02"); // dimanche
    expect(mondayOf("2026-11-09")).toBe("2026-11-09"); // lundi
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
  });
});
