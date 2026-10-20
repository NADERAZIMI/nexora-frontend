type BookMode = 'combined' | 'buy' | 'sell';

/** Presentation state only; rows and any future data source remain independent. */
export function attachOrderBookDisplay(root: HTMLElement) {
  const book = root.querySelector<HTMLElement>('[class*="__orderbookDealsWrapper"]');
  const asks = book?.querySelector<HTMLElement>('[class*="__asksWrapper"]');
  const bids = book?.querySelector<HTMLElement>('[class*="__bidsWrapper"]');
  const definitions = [
    ['combined', 'IconOrderbookUpgreen', 'Combined Buy + Sell'],
    ['buy', 'IconOrderbookBuy', 'Buy Only'],
    ['sell', 'IconOrderbookSell', 'Sell Only'],
  ] as const;
  const controls = definitions.map(([mode, icon, label]) => ({
    mode, label, element: book?.querySelector(`[data-icon="${icon}"]`)?.closest<HTMLElement>('[class*="__orderMode"]'),
  }));
  if (!book || !asks || !bids || controls.some(control => !control.element)) return () => {};

  const group = controls[0].element!.parentElement!;
  const activeClass = 'index-module-scss-module__hVXrWq__active';
  const select = (mode: BookMode) => {
    book.dataset.localOrderbookMode = mode;
    for (const control of controls) {
      control.element!.classList.toggle(activeClass, control.mode === mode);
      control.element!.setAttribute('aria-pressed', String(control.mode === mode));
    }
    // Visibility is inherited by current and future rows, without moving nodes
    // or collapsing the captured side heights and mid-price position.
    asks.setAttribute('aria-hidden', String(mode === 'buy'));
    bids.setAttribute('aria-hidden', String(mode === 'sell'));
  };
  group.setAttribute('role', 'group');
  group.setAttribute('aria-label', 'Order Book display mode');
  const cleanup = controls.map(({ mode, label, element }) => {
    const control = element!;
    control.dataset.localOrderbookControl = mode;
    control.setAttribute('role', 'button');
    control.setAttribute('aria-label', label);
    control.tabIndex = 0;
    const click = () => select(mode);
    const key = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      if (!event.repeat) select(mode);
    };
    control.addEventListener('click', click);
    control.addEventListener('keydown', key);
    return () => { control.removeEventListener('click', click); control.removeEventListener('keydown', key); };
  });
  const savedMode = book.dataset.localOrderbookMode;
  select(savedMode === 'buy' || savedMode === 'sell' ? savedMode : 'combined');
  return () => { cleanup.forEach(dispose => dispose()); };
}
