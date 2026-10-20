/** Bind only the two captured side controls; never infer actions from label text. */
function attachSideSelection(form: HTMLElement | null) {
  const group = form?.closest('[class*="__actionBox"]')?.querySelector<HTMLElement>('[class*="__dirBtnWrapper"]');
  const buy = group?.querySelector<HTMLElement>(':scope > [class*="__buyBtn"]');
  const sell = group?.querySelector<HTMLElement>(':scope > [class*="__sellBtn"]');
  if (!form || !group || !buy || !sell) return () => {};

  const controls = [['buy', buy], ['sell', sell]] as const;
  const activeClass = 'index-module-scss-module__fsa5Rq__active';
  const select = (side: 'buy' | 'sell') => {
    form.dataset.localSide = side;
    for (const [value, control] of controls) {
      control.classList.toggle(activeClass, value === side);
      control.setAttribute('aria-pressed', String(value === side));
    }
  };
  group.setAttribute('role', 'group');
  group.setAttribute('aria-label', 'Order side');
  const cleanup = controls.map(([side, control]) => {
    control.dataset.localOrderSide = side;
    control.setAttribute('role', 'button');
    control.tabIndex = 0;
    const click = () => select(side);
    const key = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      if (!event.repeat) select(side);
    };
    control.addEventListener('click', click);
    control.addEventListener('keydown', key);
    return () => { control.removeEventListener('click', click); control.removeEventListener('keydown', key); };
  });
  select(form.dataset.localSide === 'sell' ? 'sell' : 'buy');
  return () => { cleanup.forEach(dispose => dispose()); };
}

/** Local DOM state only: no balances, orders or account services are introduced. */
export function attachSpotLocalControls(root: HTMLElement) {
  const form = root.querySelector<HTMLElement>('[class*="__buyWrapper"]');
  const disposeSideSelection = attachSideSelection(form);
  const rail = form?.querySelector<HTMLElement>('.ant-slider-v2');
  const handle = rail?.querySelector<HTMLElement>('[role="slider"]');
  const track = rail?.querySelector<HTMLElement>('.ant-slider-v2-track');
  const total = form?.querySelector<HTMLInputElement>('[data-testid="spot-trade-buyTotal"]');
  const checkbox = root.querySelector<HTMLInputElement>('input.ant-checkbox-v2-input');
  const orders = checkbox?.closest('section');
  const previousTouchAction = rail?.style.touchAction ?? '';
  let activePointer: number | null = null;

  const setPercent = (value: number, writeTotal = true) => {
    if (!handle || !rail || !track || !Number.isFinite(value)) return;
    const percent = Math.min(100, Math.max(0, Math.round(value)));
    handle.style.left = `${percent}%`;
    handle.setAttribute('aria-valuenow', String(percent));
    track.style.width = `${percent}%`;
    rail.querySelectorAll<HTMLElement>('.ant-slider-v2-mark-text,.ant-slider-v2-dot').forEach(mark => {
      const active = Number.parseFloat(mark.style.left) <= percent;
      mark.classList.toggle(mark.classList.contains('ant-slider-v2-dot') ? 'ant-slider-v2-dot-active' : 'ant-slider-v2-mark-text-active', active);
    });
    // The captured available balance is zero. Price is never changed.
    if (writeTotal && total) total.value = '0';
  };
  const fromPointer = (event: PointerEvent | MouseEvent) => {
    if (!rail) return;
    const rect = rail.getBoundingClientRect();
    if (rect.width > 0) setPercent((event.clientX - rect.left) / rect.width * 100);
  };
  const pointerDown = (event: PointerEvent) => {
    if (!rail || !handle || activePointer !== null || !event.isPrimary || event.button !== 0) return;
    event.preventDefault();
    activePointer = event.pointerId;
    rail.setPointerCapture(event.pointerId);
    handle.focus({ preventScroll: true });
    fromPointer(event);
  };
  const pointerMove = (event: PointerEvent) => {
    if (event.pointerId === activePointer) fromPointer(event);
  };
  const finishPointer = (event: PointerEvent) => {
    if (event.pointerId !== activePointer || !rail) return;
    if (event.type === 'pointerup') fromPointer(event);
    activePointer = null;
    if (rail.hasPointerCapture(event.pointerId)) rail.releasePointerCapture(event.pointerId);
  };
  const losePointer = (event: PointerEvent) => {
    if (event.pointerId === activePointer) activePointer = null;
  };
  const click = (event: MouseEvent) => { fromPointer(event); };
  const key = (event: KeyboardEvent) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const current = Number(handle?.getAttribute('aria-valuenow') || 0);
    setPercent(event.key === 'Home' ? 0 : event.key === 'End' ? 100 : current + (event.key === 'ArrowRight' ? 1 : -1));
  };
  const syncCheckbox = () => {
    if (!checkbox || !orders) return;
    checkbox.closest('.ant-checkbox-v2')?.classList.toggle('ant-checkbox-v2-checked', checkbox.checked);
    checkbox.closest('.ant-checkbox-v2-wrapper')?.classList.toggle('ant-checkbox-v2-wrapper-checked', checkbox.checked);
    // Scoped contract: true = selected-pair-only, false = all pairs, in this
    // orders section only. There are no rows to filter; preserve the empty state.
    orders.dataset.localHideOtherPairs = String(checkbox.checked);
  };

  if (rail && handle) {
    rail.style.touchAction = 'none';
    handle.setAttribute('aria-label', 'Percentage of available local mock balance');
    setPercent(Number(handle.getAttribute('aria-valuenow') || 0), false);
    rail.addEventListener('pointerdown', pointerDown);
    rail.addEventListener('pointermove', pointerMove);
    rail.addEventListener('pointerup', finishPointer);
    rail.addEventListener('pointercancel', finishPointer);
    rail.addEventListener('lostpointercapture', losePointer);
    rail.addEventListener('click', click);
    handle.addEventListener('keydown', key);
  }
  syncCheckbox();
  checkbox?.addEventListener('change', syncCheckbox);
  return () => {
    disposeSideSelection();
    if (rail) {
      if (activePointer !== null && rail.hasPointerCapture(activePointer)) rail.releasePointerCapture(activePointer);
      rail.style.touchAction = previousTouchAction;
      rail.removeEventListener('pointerdown', pointerDown);
      rail.removeEventListener('pointermove', pointerMove);
      rail.removeEventListener('pointerup', finishPointer);
      rail.removeEventListener('pointercancel', finishPointer);
      rail.removeEventListener('lostpointercapture', losePointer);
      rail.removeEventListener('click', click);
    }
    handle?.removeEventListener('keydown', key);
    checkbox?.removeEventListener('change', syncCheckbox);
  };
}
