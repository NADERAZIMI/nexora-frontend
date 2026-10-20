import { decimalString, formatPrice, tickForDecimals } from './price-precision';

export type CapturedMarketId = 'BTC_USDT' | 'SHIDO_USDT' | 'WOJAK_USDT';
export interface CapturedMarket {
  readonly id: CapturedMarketId;
  readonly symbol: string;
  readonly quote: 'USDT';
  /** Recorded at the time of the supplied offline HTML capture, NOT a live quote. */
  readonly capturedPrice: string;
  /** The selected displayed precision in that capture, NOT the instrument minimum tick. */
  readonly capturedPrecision: string;
  readonly capture: 'local-btc-snapshot' | 'user-supplied-mexc-html';
}

export const CAPTURED_MARKETS: readonly CapturedMarket[] = Object.freeze([
  { id: 'BTC_USDT', symbol: 'BTC', quote: 'USDT', capturedPrice: '82106.17', capturedPrecision: '0.01', capture: 'local-btc-snapshot' },
  { id: 'SHIDO_USDT', symbol: 'SHIDO', quote: 'USDT', capturedPrice: '0.0000786', capturedPrecision: '0.0000001', capture: 'user-supplied-mexc-html' },
  { id: 'WOJAK_USDT', symbol: 'WOJAK', quote: 'USDT', capturedPrice: '0.00000004276', capturedPrecision: '0.00000000001', capture: 'user-supplied-mexc-html' },
]);

export function capturedMarket(id: string): CapturedMarket | undefined {
  return CAPTURED_MARKETS.find(market => market.id === id);
}

export function capturedMarketDisplay(id: CapturedMarketId) {
  const market = capturedMarket(id);
  if (!market) throw new Error('Unknown captured market');
  const price = decimalString(market.capturedPrice);
  const precision = decimalString(market.capturedPrecision);
  // This verifies display scale consistency only. Real order tick rules must
  // come from approved per-instrument exchange metadata.
  const decimals = precision.includes('.') ? precision.split('.')[1].length : 0;
  if (tickForDecimals(decimals) !== precision) throw new Error('Unexpected captured precision');
  return { id: market.id, label: market.symbol + '/' + market.quote,
    price, formattedPrice: formatPrice(price),
    precision, formattedPrecision: formatPrice(precision),
    source: market.capture, live: false as const };
}
