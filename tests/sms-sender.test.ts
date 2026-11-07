import { describe, expect, it } from "vitest";
import { validSmsSender } from "@/lib/telephony/sms";

describe("expéditeur des SMS", () => {
  it("accepte un numéro E.164 ou un nom de 3 à 11 caractères avec une lettre", () => {
    expect(validSmsSender("+33612345678")).toBe(true);
    expect(validSmsSender("CABINET")).toBe(true);
    expect(validSmsSender("Callpme 24")).toBe(true);
    expect(validSmsSender("12345")).toBe(false); // que des chiffres
    expect(validSmsSender("AB")).toBe(false); // trop court
    expect(validSmsSender("CABINETMEDICAL")).toBe(false); // trop long
    expect(validSmsSender("Médecin")).toBe(false); // accent
  });
});
