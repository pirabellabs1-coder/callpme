import { afterEach, describe, expect, it, vi } from "vitest";
import { SentenceChunker } from "@/lib/voice-engine/chunker";
import { generateReply, sseData } from "@/lib/llm/chat";

const env = { ...process.env };
afterEach(() => {
  process.env = { ...env };
  vi.unstubAllGlobals();
});

function sse(events: string[], split = 7): ReadableStream<Uint8Array> {
  const bytes = new TextEncoder().encode(events.map((e) => `${e}\n\n`).join(""));
  let i = 0;
  return new ReadableStream({
    pull(c) {
      if (i >= bytes.length) return c.close();
      c.enqueue(bytes.slice(i, i + split));
      i += split;
    },
  });
}

describe("découpe en phrases", () => {
  it("coupe sur la ponctuation suivie d'un espace, première phrase courte", () => {
    const c = new SentenceChunker();
    const words = "Bonjour Madame. Je regarde vos rendez-vous pour demain. Un instant.".split(/(?<= )/);
    const out = [...words.flatMap((w) => c.push(w)), ...c.flush()];
    expect(out).toEqual(["Bonjour Madame.", "Je regarde vos rendez-vous pour demain. Un instant."]);
  });

  it("ne coupe ni les nombres ni les abréviations", () => {
    const c = new SentenceChunker();
    const out = [...c.push("Votre rendez-vous avec le Dr. Martin est à 9.30 demain matin. "), ...c.flush()];
    expect(out).toEqual(["Votre rendez-vous avec le Dr. Martin est à 9.30 demain matin."]);
  });

  it("coupe une phrase très longue sans ponctuation", () => {
    const c = new SentenceChunker();
    const out = c.push("mot ".repeat(80));
    expect(out.length).toBe(1);
    expect(out[0].length).toBeLessThanOrEqual(220);
  });
});

describe("flux SSE", () => {
  it("reconstitue les événements coupés en morceaux", async () => {
    const got: string[] = [];
    for await (const d of sseData(sse(['data: {"a":1}', "event: x\r\ndata: [DONE]"], 3))) got.push(d);
    expect(got).toEqual(['{"a":1}', "[DONE]"]);
  });
});

describe("réponse LLM en flux", () => {
  const base = {
    model: { provider: "anthropic" as const, modelId: "claude-haiku-5-5", temperature: 0.4 },
    role: "appointment" as const,
    messages: [
      { role: "system" as const, content: "Assistante." },
      { role: "user" as const, content: "Un rendez-vous demain ?" },
    ],
  };

  it("Anthropic : texte transmis au fil de l'eau, outil exécuté, blocs renvoyés intacts", async () => {
    process.env = { ...env, ANTHROPIC_API_KEY: "k", OPENAI_API_KEY: "", MISTRAL_API_KEY: "" };
    const bodies: { stream?: boolean; messages: { role: string; content: unknown }[] }[] = [];
    const rounds = [
      [
        'data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}',
        'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Je regarde "}}',
        'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"l\'agenda."}}',
        'data: {"type":"content_block_start","index":1,"content_block":{"type":"tool_use","id":"tu_1","name":"checkAvailability","input":{}}}',
        'data: {"type":"content_block_delta","index":1,"delta":{"type":"input_json_delta","partial_json":"{\\"date\\":"}}',
        'data: {"type":"content_block_delta","index":1,"delta":{"type":"input_json_delta","partial_json":"\\"2026-11-07\\"}"}}',
        'data: {"type":"content_block_stop","index":1}',
        'data: {"type":"message_stop"}',
      ],
      [
        'data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}',
        'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"J\'ai 10 h."}}',
        'data: {"type":"message_stop"}',
      ],
    ];
    vi.stubGlobal("fetch", async (_url: string, init: { body: string }) => {
      bodies.push(JSON.parse(init.body));
      return new Response(sse(rounds[bodies.length - 1]), { status: 200 });
    });
    const deltas: string[] = [];
    const calls: [string, Record<string, unknown>][] = [];
    const r = await generateReply({
      ...base,
      tools: [{ name: "checkAvailability", description: "x", parameters: { type: "object", properties: {} } }],
      executeTool: async (n, a) => {
        calls.push([n, a]);
        return { message: "ok", data: { slots: ["10:00"] } };
      },
      onText: (d) => {
        deltas.push(d);
      },
    });
    expect(deltas.join("")).toBe("Je regarde l'agenda.J'ai 10 h.");
    expect(calls).toEqual([["checkAvailability", { date: "2026-11-07" }]]);
    expect(r).toMatchObject({ streamed: true, text: "Je regarde l'agenda. J'ai 10 h." });
    expect(bodies[0].stream).toBe(true);
    const assistant = bodies[1].messages[1];
    expect(assistant.role).toBe("assistant");
    expect(assistant.content).toEqual([
      { type: "text", text: "Je regarde l'agenda." },
      { type: "tool_use", id: "tu_1", name: "checkAvailability", input: { date: "2026-11-07" } },
    ]);
  });

  it("OpenAI : arguments d'outil reconstitués depuis plusieurs morceaux", async () => {
    process.env = { ...env, ANTHROPIC_API_KEY: "", OPENAI_API_KEY: "k", MISTRAL_API_KEY: "" };
    let n = 0;
    vi.stubGlobal("fetch", async () => {
      n++;
      const events =
        n === 1
          ? [
              'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"c1","function":{"name":"endCall","arguments":"{\\"rea"}}]}}]}',
              'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"son\\":\\"fin\\"}"}}]}}]}',
              "data: [DONE]",
            ]
          : ['data: {"choices":[{"delta":{"content":"Au revoir."}}]}', "data: [DONE]"];
      return new Response(sse(events), { status: 200 });
    });
    const args: Record<string, unknown>[] = [];
    const r = await generateReply({
      ...base,
      model: { provider: "openai" as const, modelId: "gpt-4o-mini", temperature: 0.4 },
      tools: [{ name: "endCall", description: "x", parameters: { type: "object", properties: {} } }],
      executeTool: async (_n, a) => {
        args.push(a);
        return { message: "ok" };
      },
      onText: () => {},
    });
    expect(args).toEqual([{ reason: "fin" }]);
    expect(r.text).toBe("Au revoir.");
    expect(r.toolCalls.map((c) => c.name)).toEqual(["endCall"]);
  });

  it("panne du fournisseur : réponse honnête, rien d'inventé", async () => {
    process.env = { ...env, ANTHROPIC_API_KEY: "k" };
    vi.stubGlobal("fetch", async () => new Response("indisponible", { status: 529 }));
    const r = await generateReply({ ...base, onText: () => {} });
    expect(r.streamed).toBeFalsy();
    expect(r.text).toContain("souci technique");
  });
});
