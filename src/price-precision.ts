/** Exact price formatting for instrument data; never convert monetary values to Number. */
export type PriceFormat = 'plain' | 'compact' | 'auto';
const DECIMAL = /^([+-]?)(\d+)(?:\.(\d*))?$/;
const COMPACT = /^([+-]?\d+)\.0\{(\d+)\}(\d+)$/;

/** Undo MEXC-style zero-run notation, e.g. 0.0{7}4276 -> 0.00000004276. */
export function expandZeroRun(input: string): string {
  const text = input.trim().replace(/,/g, '').replace(/\u200e/g, '');
  const m = text.match(COMPACT);
  if (!m) return text;
  const count = Number(m[2]);
  if (!Number.isSafeInteger(count) || count < 5 || count > 30) throw new Error('Invalid zero-run count');
  return m[1] + '.' + '0'.repeat(count) + m[3];
}

export function decimalParts(input: string): { negative: boolean; digits: bigint; scale: number } {
  const plain = expandZeroRun(input);
  const m = plain.match(DECIMAL);
  if (!m) throw new Error('Invalid decimal value');
  const frac = m[3] ?? '';
  if (frac.length > 30 || m[2].length + frac.length > 90) throw new Error('Unsupported decimal precision');
  const digits = BigInt(m[2] + frac);
  return { negative: m[1] === '-' && digits !== 0n, digits, scale: frac.length };
}

export function decimalString(input: string): string {
  const d = decimalParts(input);
  const raw = d.digits.toString().padStart(d.scale + 1, '0');
  const whole = d.scale ? raw.slice(0, -d.scale) : raw;
  const fractional = d.scale ? raw.slice(-d.scale) : '';
  return (d.negative ? '-' : '') + whole + (d.scale ? '.' + fractional : '');
}

export function formatPrice(input: string, mode: PriceFormat = 'auto'): string {
  const plain = decimalString(input);
  const negative = plain.startsWith('-');
  const unsigned = negative ? plain.slice(1) : plain;
  const [whole, fractional = ''] = unsigned.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const zeroes = fractional.match(/^0*/)?.[0].length ?? 0;
  const compact = mode === 'compact' || (mode === 'auto' && zeroes >= 5);
  const decimal = compact && zeroes >= 5 && zeroes < fractional.length
    ? '0{' + zeroes + '}' + fractional.slice(zeroes)
    : fractional;
  return (negative ? '-' : '') + grouped + (fractional ? '.' + decimal : '');
}

/** Fixed decimal representation of a tick, e.g. 0.00000000001 (11 decimals). */
export function tickForDecimals(decimals: number): string {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 30) throw new Error('Invalid price precision');
  return decimals ? '0.' + '0'.repeat(decimals - 1) + '1' : '1';
}
