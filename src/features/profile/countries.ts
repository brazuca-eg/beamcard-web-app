import { getCountries } from 'react-phone-number-input';

export interface CountryOption {
  /** Canonical English name — what we store (keeps existing data + the vCard's ADR country stable). */
  value: string;
  /** Localized display name for the current UI language. */
  label: string;
}

/**
 * Country options for the location picker, localized via the browser's built-in
 * Intl.DisplayNames (no hardcoded translation tables). Values stay English so
 * stored profiles and the vCard don't change meaning when the UI language does.
 */
export function countryOptions(lang: string): CountryOption[] {
  const localized = new Intl.DisplayNames([lang], { type: 'region' });
  const english = new Intl.DisplayNames(['en'], { type: 'region' });
  return getCountries()
    .map((code) => ({ value: english.of(code) ?? code, label: localized.of(code) ?? code }))
    .filter((o) => Boolean(o.value) && Boolean(o.label))
    .sort((a, b) => a.label.localeCompare(b.label, lang));
}

let codeByEnglishName: Map<string, string> | null = null;

/** Reverse of the stored English name → ISO code (built once, lazily). */
function englishNameToCode(name: string): string | undefined {
  if (!codeByEnglishName) {
    const english = new Intl.DisplayNames(['en'], { type: 'region' });
    codeByEnglishName = new Map();
    for (const code of getCountries()) {
      const name_ = english.of(code);
      if (name_) codeByEnglishName.set(name_.toLowerCase(), code);
    }
  }
  return codeByEnglishName.get(name.trim().toLowerCase());
}

/**
 * Display the stored (English) country name in the given language. Falls back to
 * the stored value for legacy free-text entries that don't map to a country code.
 */
export function localizeCountry(englishName: string | undefined, lang: string): string {
  if (!englishName) return '';
  const code = englishNameToCode(englishName);
  return code ? (new Intl.DisplayNames([lang], { type: 'region' }).of(code) ?? englishName) : englishName;
}
