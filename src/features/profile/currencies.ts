import type { Currency, PriceItem } from '../../api/profile';

/** The three currencies a profile can pick (mirrors the backend Currency enum). */
export const CURRENCIES: Currency[] = ['USD', 'EUR', 'UAH'];

/** Short symbol per currency, used in the picker label. */
export const CURRENCY_SYMBOL: Record<Currency, string> = {
  USD: '$',
  EUR: '€',
  UAH: '₴',
};

export interface CurrencyOption {
  value: Currency;
  label: string;
}

/**
 * Currency options for the profile picker, with the localized currency name via
 * the browser's Intl.DisplayNames (no hardcoded translation tables), e.g.
 * "€ Euro (EUR)".
 */
export function currencyOptions(lang: string): CurrencyOption[] {
  const names = new Intl.DisplayNames([lang], { type: 'currency' });
  return CURRENCIES.map((code) => ({
    value: code,
    label: `${CURRENCY_SYMBOL[code]} ${names.of(code) ?? code} (${code})`,
  }));
}

/**
 * Format a single amount in the profile's currency and the reader's locale, e.g.
 * 50 → "€50", 49.99 → "€49.99". Whole amounts drop the ".00".
 */
export function formatAmount(amount: number, currency: Currency, lang: string): string {
  return new Intl.NumberFormat(lang, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * The amounts a price row needs by type: EXACT/FROM use amount_min; RANGE uses
 * both with max ≥ min. Blank names are treated as empty.
 */
export function isPriceItemValid(item: PriceItem): boolean {
  if (!item.name.trim()) return false;
  const { price_type, amount_min, amount_max } = item;
  const hasMin = typeof amount_min === 'number' && amount_min > 0;
  const hasMax = typeof amount_max === 'number' && amount_max > 0;
  switch (price_type) {
    case 'EXACT':
    case 'FROM':
      return hasMin && !hasMax;
    case 'RANGE':
      return hasMin && hasMax && (amount_max as number) >= (amount_min as number);
    default:
      return false;
  }
}
