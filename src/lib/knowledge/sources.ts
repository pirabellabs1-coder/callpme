/**
 * Sources de la base de connaissances : fichiers (PDF, texte) et sites web.
 * Toutes les requêtes web passent par la protection SSRF (safe-fetch).
 */
import { fetchPublicText, UnsafeUrlError } from "../net/safe-fetch";
import { cleanText, extractLinks, htmlToText } from "./chunk";

/** 4 Mo : sous la limite de corps de requête des plateformes serverless (4,5 Mo sur Vercel). */
export const MAX_FILE_BYTES = 4 * 1024 * 1024;
const MAX_PDF_PAGES = 300;
const PDF_TIMEOUT_MS = 20_000;
const CRAWL_DEADLINE_MS = 45_000;
const CRAWL_QUEUE_MAX = 200;
export const MAX_DOC_CHARS = 400_000;
export const MAX_SITE_PAGES = 25;

export class SourceError extends Error {}

/** Texte d'un fichier importé (PDF, TXT, MD, CSV). */
export async function extractFileText(name: string, type: string, bytes: Uint8Array): Promise<string> {
  if (bytes.byteLength > MAX_FILE_BYTES) throw new SourceError("Fichier trop volumineux (4 Mo maximum).");
  const lower = name.toLowerCase();
  const isPdf = type === "application/pdf" || lower.endsWith(".pdf");
  // Vérification de la signature : un « PDF » doit commencer par %PDF.
  if (isPdf) {
    if (String.fromCharCode(...Array.from(bytes.slice(0, 4))) !== "%PDF") throw new SourceError("Ce fichier n'est pas un PDF valide.");
    const { getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(bytes);
    let timer: NodeJS.Timeout | undefined;
    let out = "";
    try {
      if (pdf.numPages > MAX_PDF_PAGES) throw new SourceError(`PDF trop long (${MAX_PDF_PAGES} pages maximum).`);
      // Page par page, avec un délai global : un PDF piégé ne bloque pas le serveur.
      const extract = (async () => {
        const parts: string[] = [];
        let size = 0;
        for (let i = 1; i <= pdf.numPages && size < MAX_DOC_CHARS; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          // Fin de ligne respectée : les paragraphes restent séparés pour le découpage.
          const text = content.items
            .map((it) => ("str" in it ? it.str + (it.hasEOL ? "\n" : " ") : ""))
            .join("");
          parts.push(text);
          size += text.length;
        }
        return parts.join("\n\n");
      })();
      const deadline = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new SourceError("Lecture du PDF trop longue.")), PDF_TIMEOUT_MS);
      });
      out = cleanText(await Promise.race([extract, deadline]));
    } finally {
      if (timer) clearTimeout(timer);
      void (pdf as unknown as { destroy?: () => Promise<void> }).destroy?.();
    }
    if (!out) throw new SourceError("Aucun texte dans ce PDF (document scanné ? Il faut un PDF avec du texte sélectionnable).");
    return out.slice(0, MAX_DOC_CHARS);
  }
  if (/\.(txt|md|markdown|csv)$/i.test(lower) || type.startsWith("text/")) {
    const out = cleanText(new TextDecoder("utf-8", { fatal: false }).decode(bytes));
    if (!out) throw new SourceError("Le fichier est vide.");
    return out.slice(0, MAX_DOC_CHARS);
  }
  throw new SourceError("Format non pris en charge : PDF, TXT, MD ou CSV.");
}

export interface PageText {
  url: string;
  title: string;
  text: string;
}

function titleOf(html: string, fallback: string): string {
  const m = html.match(/<title[^>]*>([^<]{1,200})<\/title>/i);
  return htmlToText(m?.[1] ?? "").slice(0, 160) || fallback;
}

/** Une page web (protégée SSRF). */
export async function fetchPage(url: string): Promise<PageText & { html: string; finalUrl: URL }> {
  try {
    const { text: html, finalUrl } = await fetchPublicText(url, { timeoutMs: 10000, maxBytes: 2 * 1024 * 1024 });
    return { url: finalUrl.toString(), finalUrl, html, title: titleOf(html, finalUrl.hostname), text: htmlToText(html).slice(0, MAX_DOC_CHARS) };
  } catch (e) {
    if (e instanceof UnsafeUrlError) throw new SourceError(e.message);
    throw new SourceError("Impossible de récupérer cette page.");
  }
}

/**
 * Exploration d'un site : à partir d'une page, suit les liens du même hôte
 * (largeur d'abord), au plus `maxPages` pages et 2 niveaux de profondeur.
 */
export async function crawlSite(startUrl: string, maxPages = MAX_SITE_PAGES): Promise<PageText[]> {
  const started = Date.now();
  const first = await fetchPage(startUrl);
  const host = first.finalUrl.host;
  let attempts = 0;
  const pages: PageText[] = [];
  const seen = new Set<string>([first.url]);
  const queue: { url: string; depth: number }[] = [];
  const visit = (p: { url: string; title: string; text: string; html: string; finalUrl: URL }, depth: number) => {
    if (p.text.length > 80) pages.push({ url: p.url, title: p.title, text: p.text });
    if (depth >= 2) return;
    for (const link of extractLinks(p.html, p.finalUrl)) {
      if (!seen.has(link) && queue.length < CRAWL_QUEUE_MAX) {
        seen.add(link);
        queue.push({ url: link, depth: depth + 1 });
      }
    }
  };
  visit(first, 0);
  // Budgets : nombre de requêtes et durée totale (un site hostile ne peut pas
  // faire tourner l'exploration indéfiniment).
  while (queue.length && pages.length < maxPages && attempts < maxPages * 2 && Date.now() - started < CRAWL_DEADLINE_MS) {
    const batch = queue.splice(0, 4);
    attempts += batch.length;
    const results = await Promise.allSettled(batch.map((b) => fetchPage(b.url)));
    results.forEach((r, i) => {
      // Une redirection vers un autre domaine n'est pas suivie.
      if (r.status === "fulfilled" && r.value.finalUrl.host === host && pages.length < maxPages) visit(r.value, batch[i].depth);
    });
  }
  if (pages.length === 0) throw new SourceError("Aucun texte trouvé sur ce site.");
  return pages;
}
