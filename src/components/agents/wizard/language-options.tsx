import { LANGUAGES, languageOptionLabel } from "@/lib/agents/catalog";

const GROUPS = [
  { family: "fr", label: "Français" },
  { family: "en", label: "Anglais" },
  { family: "local", label: "Langues locales" },
] as const;

/**
 * Options d'un <select> de langue, groupées (français, anglais, langues locales).
 * Une langue qui n'est pas encore disponible reste visible avec son état
 * (« bientôt », « en activation (clé fournisseur manquante) ») mais ne peut pas être choisie — sauf la langue
 * actuelle (`current`), pour qu'un agent existant reste modifiable.
 */
export function LanguageOptions({ current }: { current?: string }) {
  return (
    <>
      {GROUPS.map((g) => {
        const items = LANGUAGES.filter((l) => l.family === g.family);
        if (items.length === 0) return null;
        return (
          <optgroup key={g.family} label={g.label}>
            {items.map((l) => (
              <option key={l.id} value={l.id} disabled={l.availability !== "disponible" && l.id !== current}>
                {languageOptionLabel(l)}
              </option>
            ))}
          </optgroup>
        );
      })}
    </>
  );
}
