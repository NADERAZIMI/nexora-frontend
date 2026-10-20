import { CAPTURED_MARKETS, capturedMarketDisplay } from './captured-market-catalog';

export function attachCapturedMarketPreview(root: HTMLElement): () => void {
  const heading = root.querySelector<HTMLElement>('[class*="__symbolInfoBox"] [class*="__bigName"]');
  const anchor = heading?.closest<HTMLElement>('[class*="__infoWrapper"]');
  if (!heading || !anchor) return () => {};
  heading.setAttribute('role', 'button');
  heading.setAttribute('tabindex', '0');
  heading.setAttribute('aria-label', 'Inspect captured market examples');
  heading.setAttribute('aria-expanded', 'false');
  const panel = document.createElement('div');
  panel.className = 'nexora-market-preview';
  panel.hidden = true;
  panel.setAttribute('role', 'region');
  panel.setAttribute('aria-label', 'Captured market price examples');
  const headingLine = document.createElement('div');
  headingLine.className = 'nexora-market-preview-title';
  headingLine.textContent = 'Offline market examples — not live data';
  const sample = document.createElement('div');
  sample.className = 'nexora-market-preview-value';
  sample.setAttribute('aria-live', 'polite');
  const choices = document.createElement('div');
  choices.className = 'nexora-market-preview-choices';
  const buttons = CAPTURED_MARKETS.map(market => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = market.symbol;
    button.setAttribute('aria-pressed', String(market.id === 'BTC_USDT'));
    button.addEventListener('click', event => { event.stopPropagation(); show(market.id); });
    choices.append(button);
    return { id: market.id, button };
  });
  const warning = document.createElement('div');
  warning.className = 'nexora-market-preview-warning';
  warning.textContent = 'Price examples only. The order book remains the saved BTC/USDT snapshot.';
  panel.append(headingLine, choices, sample, warning);
  // The archived headline sits inside transformed, clipped layout wrappers.
  // Portal the menu to body so it overlays the chart instead of being clipped.
  document.body.append(panel);
  const positionPanel = () => {
    const rect = anchor.getBoundingClientRect();
    panel.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - Math.min(620, window.innerWidth - 16) - 8))}px`;
    panel.style.top = `${rect.bottom + 6}px`;
  };
  positionPanel();
  window.addEventListener('resize', positionPanel);
  window.addEventListener('scroll', positionPanel, true);
  function show(id: 'BTC_USDT' | 'SHIDO_USDT' | 'WOJAK_USDT') {
    const item = capturedMarketDisplay(id);
    sample.textContent = item.label + ': ' + item.formattedPrice + ' USDT | displayed precision: ' + item.formattedPrecision;
    buttons.forEach(choice => choice.button.setAttribute('aria-pressed', String(choice.id === id)));
  }
  show('BTC_USDT');
  const close = () => { panel.hidden = true; heading.setAttribute('aria-expanded', 'false'); };
  const toggle = (event?: Event) => { event?.stopPropagation(); if (panel.hidden) positionPanel(); panel.hidden = !panel.hidden; heading.setAttribute('aria-expanded', String(!panel.hidden)); };
  const key = (event: KeyboardEvent) => {
    if (event.key === 'Escape') { close(); return; }
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggle(event); }
  };
  const outside = (event: MouseEvent) => {
    if (!panel.hidden && !anchor.contains(event.target as Node) && !panel.contains(event.target as Node)) close();
  };
  heading.addEventListener('click', toggle);
  heading.addEventListener('keydown', key);
  document.addEventListener('click', outside);
  return () => {
    heading.removeEventListener('click', toggle);
    heading.removeEventListener('keydown', key);
    document.removeEventListener('click', outside);
    heading.removeAttribute('role');
    heading.removeAttribute('tabindex');
    heading.removeAttribute('aria-label');
    heading.removeAttribute('aria-expanded');
    window.removeEventListener('resize', positionPanel);
    window.removeEventListener('scroll', positionPanel, true);
    panel.remove();
  };
}
