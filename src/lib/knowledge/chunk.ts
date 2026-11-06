/**
 * Découpage d'un texte en passages pour la recherche (fonction pure, testée).
 *
 * On coupe d'abord sur les paragraphes, puis sur les phrases, pour que chaque
 * passage reste lisible et autonome (~900 caractères), avec un léger
 * recouvrement afin qu'une information à cheval sur deux passages ne soit
 * pas perdue.
 */

export const CHUNK_SIZE = 900;
export const CHUNK_OVERLAP = 150;

/** Normalise un texte extrait (espaces, lignes vides, caractères de contrôle). */
export function cleanText(raw: string): string {
  return raw
    .replace(/\r\n?/g, "\n")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, " ")
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function splitSentences(paragraph: string): string[] {
  return paragraph.match(/[^.!?…]+[.!?…]+["»)]?\s*|[^.!?…]+$/g)?.map((s) => s.trim()).filter(Boolean) ?? [paragraph];
}

export function chunkText(raw: string, size = CHUNK_SIZE, overlap = CHUNK_OVERLAP): string[] {
  const text = cleanText(raw);
  if (!text) return [];
  // Unités : paragraphes, ou phrases pour les paragraphes trop longs, ou
  // coupe franche pour une « phrase » démesurée (tableau, liste sans ponctuation).
  const units: string[] = [];
  for (const para of text.split(/\n{2,}/)) {
    if (para.length <= size) {
      units.push(para);
      continue;
    }
    for (const sentence of splitSentences(para)) {
      if (sentence.length <= size) units.push(sentence);
      else for (let i = 0; i < sentence.length; i += size - overlap) units.push(sentence.slice(i, i + size));
    }
  }

  const chunks: string[] = [];
  let current = "";
  for (const unit of units) {
    if (current && current.length + unit.length + 1 > size) {
      chunks.push(current);
      // Recouvrement : on reprend la fin du passage précédent.
      const tail = current.slice(-overlap);
      const cut = tail.indexOf(" ");
      current = (cut > 0 ? tail.slice(cut + 1) : tail) + " " + unit;
    } else {
      current = current ? `${current}\n${unit}` : unit;
    }
  }
  if (current.trim()) chunks.push(current);
  return chunks.map((c) => c.trim()).filter((c) => c.length > 20);
}

/** Texte brut d'une page HTML (sans scripts, styles, menus de navigation). */
export function htmlToText(html: string): string {
  return cleanText(
    html
      .replace(/<(script|style|noscript|svg|nav|footer|header|form)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|h[1-6]|tr|section|article)>/gi, "\n\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;|&apos;/gi, "'")
      .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))),
  );
}

/** Liens internes d'une page (même hôte), normalisés, sans ancres ni fichiers. */
export function extractLinks(html: string, base: URL): string[] {
  const out = new Set<string>();
  const re = /<a\s[^>]*href\s*=\s*["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    try {
      const u = new URL(m[1], base);
      if (u.host !== base.host || !/^https?:$/.test(u.protocol)) continue;
      if (/\.(pdf|jpe?g|png|gif|webp|svg|zip|mp[34]|docx?|xlsx?|css|js)$/i.test(u.pathname)) continue;
      u.hash = "";
      u.search = "";
      out.add(u.toString());
    } catch {
      /* lien invalide */
    }
  }
  return Array.from(out);
}
