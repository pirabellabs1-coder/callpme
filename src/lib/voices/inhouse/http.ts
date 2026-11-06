/** Petits utilitaires HTTP des routes voix maison. */

/** Réponse binaire privée (jamais mise en cache par un proxy). */
export function binaryResponse(bytes: Uint8Array, mime: string, filename?: string): Response {
  const headers: Record<string, string> = {
    "Content-Type": mime,
    "Content-Length": String(bytes.byteLength),
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  };
  if (filename) headers["Content-Disposition"] = `inline; filename="${filename.replace(/[^\w.-]/g, "_")}"`;
  return new Response(Buffer.from(bytes), { headers });
}

/** Lit un fichier d'un FormData en refusant les fichiers trop gros. */
export async function readFormFile(
  form: FormData,
  field: string,
  maxBytes: number,
): Promise<{ bytes: Uint8Array; name: string } | { error: string }> {
  const file = form.get(field);
  if (!(file instanceof Blob) || file.size === 0) return { error: "Fichier manquant." };
  if (file.size > maxBytes) return { error: `Fichier trop lourd (${Math.round(maxBytes / 1024 / 1024)} Mo maximum).` };
  const name = "name" in file && typeof file.name === "string" ? file.name.slice(0, 120) : field;
  return { bytes: new Uint8Array(await file.arrayBuffer()), name };
}

/** Signature binaire des documents de consentement acceptés. */
export function sniffConsentDocument(b: Uint8Array): "application/pdf" | "image/jpeg" | "image/png" | null {
  const text = (from: number, to: number) => String.fromCharCode.apply(null, Array.from(b.subarray(from, to)));
  if (b.length >= 5 && text(0, 5) === "%PDF-") return "application/pdf";
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 8 && b[0] === 0x89 && text(1, 4) === "PNG") return "image/png";
  return null;
}
