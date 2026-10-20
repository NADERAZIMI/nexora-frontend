import { memo, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import snapshot from './snapshot.html?raw';
import { attachSpotLocalControls } from './spot-local-controls';
import { attachOrderBookDisplay } from './orderbook-display';
import { attachSpotHeaderLive } from './spot-header-live';
import { attachBybitSpotTransition } from './bybit-spot-transition';
import './reference.css';
import './palette.css';
import './prototype.css';
import './fidelity.css';

/** The archived DOM is deliberately retained to preserve all source geometry. */
const SnapshotSurface = memo(function SnapshotSurface({ onNotice }: { onNotice: (message: string) => void }) {
  const surface = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = surface.current!;
    // Rebrand visible text from archived reference without changing API routes, links, or asset URLs.
    const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    let textNode:Node|null=walker.nextNode();
    while(textNode){
      const parent=textNode.parentElement;
      if(parent&&!parent.closest('script,style,noscript')&&textNode.textContent?.includes('MEXC')){
        textNode.textContent=textNode.textContent.replaceAll('MEXC','NEXORA');
      }
      textNode=walker.nextNode();
    }
    const disposeHeaderLive = attachSpotHeaderLive(root);
    const disposeLocalControls = attachSpotLocalControls(root);
    const disposeOrderBookDisplay = attachOrderBookDisplay(root);
    const disposeBybitTransition = attachBybitSpotTransition(root);
    const headerSearch = root.querySelector<HTMLInputElement>('#globalNav input.ant-input-sm');
    headerSearch?.setAttribute('aria-label', 'Search live Spot markets');
    const openSearch = () => {
      root.dispatchEvent(new CustomEvent('nexora:open-market-search', {
        detail: { query: headerSearch?.value ?? '' }
      }));
    };
    const searchInput = (event: Event) => {
      if (!(event.target instanceof HTMLInputElement)) return;
      if (event.target.value.trim()) openSearch();
    };
    headerSearch?.addEventListener('input', searchInput);
    const click = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const tab = target.closest<HTMLElement>('[role="tab"]');
      if (tab) {
        event.preventDefault();
        if (tab.getAttribute('aria-selected') === 'true') return;
        // Other panels were not captured by SingleFile; don't fabricate their contents.
        onNotice(`Local mock prototype: ${tab.textContent?.trim()} contents are not included in the saved HTML.`);
        return;
      }
      if (target.closest('[class*="__symbolInfoBox"] [class*="__bigName"]')) return;
      const interval = target.closest('[class*="__favInterval"], [class*="__chartType"], [class*="__bigName"]');
      if (interval) { onNotice('NEXORA: Bybit chart integration is the next phase.'); return; }
      const action = target.closest('button,a');
      if (action) {
        event.preventDefault();
        onNotice(`Local mock prototype: ${action.textContent?.trim() || 'this action'} has no connected service.`);
      }
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Enter' && event.target === headerSearch) {
        event.preventDefault();
        openSearch();
      }
    };
    root.addEventListener('click', click);
    root.addEventListener('keydown', key);
    return () => { disposeBybitTransition(); disposeHeaderLive(); disposeOrderBookDisplay(); disposeLocalControls(); root.removeEventListener('click', click); root.removeEventListener('keydown', key); headerSearch?.removeEventListener('input', searchInput); };
  }, [onNotice]);
  return <div className="snapshot-surface" ref={surface} dangerouslySetInnerHTML={{ __html: snapshot }} />;
});
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

