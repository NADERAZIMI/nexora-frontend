import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import snapshot from './snapshot.html?raw';
import './reference.css';
import './palette.css';
import './prototype.css';
import './fidelity.css';

/** The archived DOM is deliberately retained to preserve all source geometry. */
function SnapshotSurface({ onNotice }: { onNotice: (message: string) => void }) {
  const surface = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = surface.current!;
    const slider = root.querySelector<HTMLElement>('[role="slider"]');
    slider?.setAttribute('aria-label', 'Percentage of available local mock balance');
    root.querySelectorAll<HTMLInputElement>('input[type=text]').forEach((input, i) => {
      input.setAttribute('aria-label', ['Search markets (local snapshot)', 'Price (USDT)', 'Total (USDT)'][i]);
      if (i > 0) input.inputMode = 'decimal';
    });
    const setPercent = (value: number) => {
      const percent = Math.min(100, Math.max(0, Math.round(value)));
      slider!.style.left = `${percent}%`;
      slider!.setAttribute('aria-valuenow', String(percent));
      root.querySelector<HTMLElement>('.ant-slider-v2-track')!.style.width = `${percent}%`;
      // The saved available balance is zero; no fictional funds are introduced.
      const total = root.querySelector<HTMLInputElement>('[data-testid="spot-trade-buyTotal"]');
      if (total) total.value = '0';
    };
    const click = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const rail = target.closest<HTMLElement>('.ant-slider-v2');
      if (rail) { const rect = rail.getBoundingClientRect(); setPercent((event.clientX - rect.left) / rect.width * 100); return; }
      const tab = target.closest<HTMLElement>('[role="tab"]');
      if (tab) {
        event.preventDefault();
        if (tab.getAttribute('aria-selected') === 'true') return;
        // Other panels were not captured by SingleFile; don't fabricate their contents.
        onNotice(`Local mock prototype: ${tab.textContent?.trim()} contents are not included in the saved HTML.`);
        return;
      }
      const side = target.closest<HTMLElement>('[class*="__buyBtn"],[class*="__sellBtn"]');
      if (side && ['Buy', 'Sell'].includes(side.textContent?.trim() || '')) {
        const sell = side.textContent?.trim() === 'Sell';
        root.querySelectorAll<HTMLElement>('[class*="__buyBtn"],[class*="__sellBtn"]').forEach(el => {
          if (['Buy', 'Sell'].includes(el.textContent?.trim() || '')) el.classList.toggle('index-module-scss-module__fsa5Rq__active', el === side);
        });
        const form = root.querySelector<HTMLElement>('[class*="__buyWrapper"]');
        if (form) form.dataset.localSide = sell ? 'sell' : 'buy';
        return;
      }
      const interval = target.closest('[class*="__favInterval"], [class*="__chartType"], [class*="__bigName"]');
      if (interval) { onNotice('Local mock prototype: the chart and BTC/USDT market are the static saved reference.'); return; }
      const action = target.closest('button,a');
      if (action) {
        event.preventDefault();
        onNotice(`Local mock prototype: ${action.textContent?.trim() || 'this action'} has no connected service.`);
      }
    };
    const key = (event: KeyboardEvent) => {
      if (event.target === slider && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
        event.preventDefault();
        const current = Number(slider?.getAttribute('aria-valuenow') || 0);
        setPercent(event.key === 'Home' ? 0 : event.key === 'End' ? 100 : current + (event.key === 'ArrowRight' ? 1 : -1));
      }
      if (event.key === 'Enter' && event.target instanceof HTMLInputElement && event.target.classList.contains('ant-input-sm')) {
        onNotice('Local mock data: only the saved BTC/USDT market is available.');
      }
    };
    root.addEventListener('click', click);
    root.addEventListener('keydown', key);
    return () => { root.removeEventListener('click', click); root.removeEventListener('keydown', key); };
  }, [onNotice]);
  return <div className="snapshot-surface" ref={surface} dangerouslySetInnerHTML={{ __html: snapshot }} />;
}
function App() {
  const [notice, setNotice] = useState('');
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(''), 5000);
    return () => window.clearTimeout(timer);
  }, [notice]);
  return <><SnapshotSurface onNotice={setNotice} />{notice && <div className="prototype-notice" role="status">{notice}<button aria-label="Dismiss notice" onClick={() => setNotice('')}>×</button></div>}</>;
}
createRoot(document.getElementById('root')!).render(<App />);

