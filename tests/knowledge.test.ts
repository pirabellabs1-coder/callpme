import { describe, expect, it } from "vitest";
import { chunkText, cleanText, extractLinks, htmlToText, CHUNK_SIZE } from "@/lib/knowledge/chunk";
import { extractFileText, SourceError } from "@/lib/knowledge/sources";

describe("découpage en passages", () => {
  it("garde un texte court en un seul passage", () => {
    expect(chunkText("Le cabinet est ouvert du lundi au vendredi, de 9 h à 18 h.")).toHaveLength(1);
  });

  it("découpe un long texte en passages bornés, avec recouvrement", () => {
    const para = (i: number) => `Paragraphe ${i}. ` + "Le cabinet propose des soins dentaires complets pour toute la famille. ".repeat(6);
    const text = Array.from({ length: 12 }, (_, i) => para(i)).join("\n\n");
    const chunks = chunkText(text);
    expect(chunks.length).toBeGreaterThan(5);
    expect(chunks.every((c) => c.length <= CHUNK_SIZE + 200)).toBe(true);
    // Aucune information perdue : chaque paragraphe apparaît dans un passage.
    for (let i = 0; i < 12; i++) expect(chunks.some((c) => c.includes(`Paragraphe ${i}.`))).toBe(true);
  });

  it("coupe une « phrase » démesurée sans ponctuation (tableau, liste)", () => {
    const chunks = chunkText("tarif ".repeat(800));
    expect(chunks.length).toBeGreaterThan(3);
  });

  it("nettoie les espaces et lignes vides", () => {
    expect(cleanText("a  \t b\n\n\n\nc")).toBe("a b\n\nc");
  });
});

describe("pages web", () => {
  it("extrait le texte sans scripts ni navigation", () => {
    const html = "<html><head><script>var x=1</script><style>p{}</style></head><body><nav>Menu</nav><h1>Tarifs</h1><p>Consultation : 25&nbsp;€</p></body></html>";
    const text = htmlToText(html);
    expect(text).toContain("Tarifs");
    expect(text).toContain("Consultation : 25 €");
    expect(text).not.toContain("var x");
    expect(text).not.toContain("Menu");
  });

  it("ne suit que les liens du même site, sans fichiers", () => {
    const base = new URL("https://cabinet.example/");
    const links = extractLinks(
      '<a href="/tarifs">t</a><a href="https://autre.example/x">x</a><a href="/doc.pdf">p</a><a href="/contact#form">c</a>',
      base,
    );
    expect(links).toEqual(["https://cabinet.example/tarifs", "https://cabinet.example/contact"]);
  });
});

describe("fichiers importés", () => {
  it("lit un fichier texte", async () => {
    const bytes = new TextEncoder().encode("Horaires : 9 h – 18 h");
    await expect(extractFileText("faq.txt", "text/plain", bytes)).resolves.toContain("Horaires");
  });

  it("refuse un faux PDF et un format inconnu", async () => {
    await expect(extractFileText("x.pdf", "application/pdf", new TextEncoder().encode("pas un pdf"))).rejects.toBeInstanceOf(SourceError);
    await expect(extractFileText("x.exe", "application/octet-stream", new Uint8Array([1, 2]))).rejects.toBeInstanceOf(SourceError);
  });
});
