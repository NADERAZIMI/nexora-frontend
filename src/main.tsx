import { memo, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import snapshot from './snapshot.html?raw';
import { attachSpotLocalControls } from './spot-local-controls';
import './reference.css';
import './palette.css';
import './prototype.css';
import './fidelity.css';

/** The archived DOM is deliberately retained to preserve all source geometry. */
const SnapshotSurface = memo(function SnapshotSurface({ onNotice }: { onNotice: (message: string) => void }) {
  const surface = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = surface.current!;
    const disposeLocalControls = attachSpotLocalControls(root);
    root.querySelector('input.ant-input-sm')?.setAttribute('aria-label', 'Search markets (local snapshot)');
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
      const interval = target.closest('[class*="__favInterval"], [class*="__chartType"], [class*="__bigName"]');
      if (interval) { onNotice('Local mock prototype: the chart and BTC/USDT market are the static saved reference.'); return; }
      const action = target.closest('button,a');
      if (action) {
        event.preventDefault();
        onNotice(`Local mock prototype: ${action.textContent?.trim() || 'this action'} has no connected service.`);
      }
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Enter' && event.target instanceof HTMLInputElement && event.target.classList.contains('ant-input-sm')) {
        onNotice('Local mock data: only the saved BTC/USDT market is available.');
      }
    };
    root.addEventListener('click', click);
    root.addEventListener('keydown', key);
    return () => { disposeLocalControls(); root.removeEventListener('click', click); root.removeEventListener('keydown', key); };
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

