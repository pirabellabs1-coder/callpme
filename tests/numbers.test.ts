import { afterEach, describe, expect, it, vi } from "vitest";
import { buyNumber, NumberError, releaseNumber, searchNumbers } from "@/lib/telephony/numbers";

const env = { ...process.env };
afterEach(() => {
  process.env = { ...env };
  vi.unstubAllGlobals();
});

function twilio() {
  process.env.TELEPHONY_PROVIDER = "twilio";
  process.env.TWILIO_ACCOUNT_SID = "AC_test";
  process.env.TWILIO_AUTH_TOKEN = "tok";
  process.env.PUBLIC_URL = "https://app.callpme.test";
}

describe("achat de numéros (Twilio)", () => {
  it("cherche des numéros français et renvoie la localité", async () => {
    twilio();
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ available_phone_numbers: [{ phone_number: "+33184801199", locality: "Paris", region: "IDF" }] }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const res = await searchNumbers({ country: "FR", type: "local", contains: "18 4" });
    expect(res).toEqual([{ phoneNumber: "+33184801199", locality: "Paris", region: "IDF" }]);
    expect(String((fetchMock.mock.calls[0] as unknown as [string])[0])).toContain("/AvailablePhoneNumbers/FR/Local.json?PageSize=20&VoiceEnabled=true&Contains=184");
  });

  it("refuse un pays ou un type non proposé", async () => {
    twilio();
    await expect(searchNumbers({ country: "DE", type: "local" })).rejects.toBeInstanceOf(NumberError);
    await expect(searchNumbers({ country: "CH", type: "mobile" })).rejects.toBeInstanceOf(NumberError);
  });

  it("achète un numéro relié au moteur vocal et relaie le refus de l'opérateur", async () => {
    twilio();
    const ok = vi.fn(async () => new Response(JSON.stringify({ sid: "PN123" }), { status: 201 }));
    vi.stubGlobal("fetch", ok);
    await expect(buyNumber("+33184801199")).resolves.toEqual({ providerRef: "PN123", provider: "twilio" });
    const body = new URLSearchParams((ok.mock.calls[0] as unknown as [string, { body: URLSearchParams }])[1].body);
    expect(body.get("VoiceUrl")).toBe("https://app.callpme.test/api/telephony/inbound");

    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ message: "Un justificatif d'adresse est requis." }), { status: 400 })));
    // Le détail de l'opérateur reste dans les journaux ; le client reçoit un message générique.
    await expect(buyNumber("+33184801199")).rejects.toThrow("justificatif d'identité ou d'adresse");
  });

  it("rend un numéro à l'opérateur", async () => {
    twilio();
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 204 })));
    await expect(releaseNumber("twilio", "PN123", "+33184801199")).resolves.toBe(true);
  });
});

import { countryOfNumber } from "@/lib/telephony/numbers";

describe("pays des numéros achetés", () => {
  it("n'accepte que les pays proposés, avec leur prix", () => {
    expect(countryOfNumber("+33184801199")?.monthlyEur).toBe(3);
    expect(countryOfNumber("+2250701020304")?.code).toBe("CI");
    expect(countryOfNumber("+237612345678")).toBeNull(); // Cameroun : non proposé à l'achat
  });
});
