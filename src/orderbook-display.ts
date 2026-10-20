import { formatPrice } from './price-precision';

type BookMode = 'combined' | 'buy' | 'sell';

/** Presentation state only; rows and any future data source remain independent. */
export function attachOrderBookDisplay(root: HTMLElement) {
  const book = root.querySelector<HTMLElement>('[class*="__orderbookDealsWrapper"]');
  const asks = book?.querySelector<HTMLElement>('[class*="__asksWrapper"]');
  const bids = book?.querySelector<HTMLElement>('[class*="__bidsWrapper"]');
  const header = book?.querySelector<HTMLElement>('[class*="__hVXrWq__tableHeader"]');
  const body = book?.querySelector<HTMLElement>('[class*="__hVXrWq__tableBody"]');
  const definitions = [
    ['combined', 'IconOrderbookUpgreen', 'Combined Buy + Sell'],
    ['buy', 'IconOrderbookBuy', 'Buy Only'],
    ['sell', 'IconOrderbookSell', 'Sell Only'],
  ] as const;
  const controls = definitions.map(([mode, icon, label]) => ({
    mode, label, element: book?.querySelector(`[data-icon="${icon}"]`)?.closest<HTMLElement>('[class*="__orderMode"]'),
  }));
  if (!book || !asks || !bids || !header || !body || controls.some(control => !control.element)) return () => {};

  // The archived BTC snapshot verifies only 0.01. Other ticks cannot be
  // offered until the selected instrument's metadata and depth are available.
  const precisionTrigger = book.querySelector<HTMLElement>('[class*="__settingWrapper"] [class*="__drop"]');
  const capturedPrecision = precisionTrigger?.querySelector('span')?.textContent?.trim() ?? '';
  let precisionMenu: HTMLElement | null = null;
  let precisionOpen = false;
  const closePrecision = (restoreFocus = false) => {
    precisionOpen = false;
    if (precisionMenu) precisionMenu.hidden = true;
    precisionTrigger?.setAttribute('aria-expanded', 'false');
    if (restoreFocus) precisionTrigger?.focus();
  };
  const togglePrecision = (event: Event) => {
    event.preventDefault();
    event.stopPropagation();
    precisionOpen = !precisionOpen;
    if (precisionMenu) precisionMenu.hidden = !precisionOpen;
    precisionTrigger?.setAttribute('aria-expanded', String(precisionOpen));
  };
  const precisionKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape') { closePrecision(true); return; }
    if (event.key === 'Enter' || event.key === ' ') togglePrecision(event);
  };
  const outsidePrecision = (event: MouseEvent) => {
    if (precisionOpen && precisionTrigger && !precisionTrigger.contains(event.target as Node) && !precisionMenu?.contains(event.target as Node)) closePrecision();
  };
  if (precisionTrigger && capturedPrecision) {
    const host = precisionTrigger.parentElement!;
    host.style.position = host.style.position || 'relative';
    precisionTrigger.setAttribute('role', 'button');
    precisionTrigger.setAttribute('tabindex', '0');
    precisionTrigger.setAttribute('aria-label', 'Order Book price precision');
    precisionTrigger.setAttribute('aria-haspopup', 'menu');
    precisionTrigger.setAttribute('aria-expanded', 'false');
    precisionMenu = document.createElement('div');
    precisionMenu.hidden = true;
    precisionMenu.setAttribute('role', 'menu');
    precisionMenu.setAttribute('aria-label', 'Price precision options');
    precisionMenu.style.cssText = 'position:absolute;right:0;top:100%;z-index:50;min-width:180px;padding:6px 0;background:var(--bg-secondary);color:var(--text-primary);border:1px solid var(--text-secondary);border-radius:4px;box-shadow:0 4px 12px #0008;';
    const choice = document.createElement('button');
    choice.type = 'button';
    choice.setAttribute('role', 'menuitemradio');
    choice.setAttribute('aria-checked', 'true');
    choice.textContent = capturedPrecision;
    choice.style.cssText = 'display:block;width:100%;padding:8px 12px;border:0;text-align:left;color:var(--text-primary);background:transparent;cursor:pointer;font:inherit;';
    choice.addEventListener('click', event => { event.stopPropagation(); closePrecision(true); });
    const note = document.createElement('div');
    note.textContent = 'More levels require instrument data';
    note.style.cssText = 'padding:8px 12px;color:var(--text-secondary);font-size:11px;white-space:nowrap;';
    note.setAttribute('role', 'note');
    precisionMenu.append(choice, note);
    host.append(precisionMenu);
    precisionTrigger.addEventListener('click', togglePrecision);
    precisionTrigger.addEventListener('keydown', precisionKey);
    document.addEventListener('click', outsidePrecision);
  }

  // Normalize only actual captured price text, preserving the archived DOM
  // structure, source precision and row identity. Future instrument adapters
  // can apply the same formatter when replacing the snapshot with live depth.
  const changedPrices: Array<{ node: HTMLElement; original: string }> = [];
  for (const node of book.querySelectorAll<HTMLElement>(
    '[class*="__asksWrapper"] [class*="__orderbookItem"] > [class*="__price"], ' +
    '[class*="__bidsWrapper"] [class*="__orderbookItem"] > [class*="__price"]'
  )) {
    if (node.children.length) continue;
    const originalPrice = node.textContent?.trim() ?? '';
    try {
      const normalized = formatPrice(originalPrice);
      if (normalized !== originalPrice) {
        changedPrices.push({ node, original: node.textContent ?? '' });
        node.textContent = normalized;
      }
    } catch {
      // Captured labels are not assumed to be prices; never corrupt a cell.
    }
  }

  const alignContent = () => {
    const parent = body.offsetParent;
    if (!(parent instanceof HTMLElement)) return;
    const top = header.getBoundingClientRect().bottom - parent.getBoundingClientRect().top - parent.clientTop + parent.scrollTop;
    book.style.setProperty('--local-orderbook-content-top', `${top}px`);
  };
  alignContent();
  const resize = new ResizeObserver(alignContent);
  resize.observe(book);
  resize.observe(header);

  const group = controls[0].element!.parentElement!;
  const activeClass = 'index-module-scss-module__hVXrWq__active';
  const select = (mode: BookMode) => {
    book.dataset.localOrderbookMode = mode;
    for (const control of controls) {
      control.element!.classList.toggle(activeClass, control.mode === mode);
      control.element!.setAttribute('aria-pressed', String(control.mode === mode));
    }
    // Mode-scoped CSS removes the excluded section from flow without moving,
    // rewriting or recreating any captured row nodes.
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
  return () => { changedPrices.forEach(({ node, original }) => { node.textContent = original; }); closePrecision(); precisionTrigger?.removeEventListener('click', togglePrecision); precisionTrigger?.removeEventListener('keydown', precisionKey); document.removeEventListener('click', outsidePrecision); precisionMenu?.remove(); resize.disconnect(); cleanup.forEach(dispose => dispose()); };
}
