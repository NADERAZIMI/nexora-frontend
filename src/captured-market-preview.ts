import { getMexcSpotMarkets, type MexcSpotMarket } from './mexc-public-markets';
import { formatPrice } from './price-precision';
import { CAPTURED_MARKETS, capturedMarketDisplay } from './captured-market-catalog';

export function attachCapturedMarketPreview(root: HTMLElement): () => void {
  const heading = root.querySelector<HTMLElement>('[class*="__symbolInfoBox"] [class*="__bigName"]');
  const anchor = heading?.closest<HTMLElement>('[class*="__infoWrapper"]');
  const originalHeading = heading?.querySelector('h1')?.textContent ?? 'BTC/USDT';
  const titleNode = heading?.querySelector<HTMLElement>('h1');
  const originalSubname = anchor?.querySelector<HTMLElement>('[class*="__fullName"]')?.textContent ?? '';
  const subname = anchor?.querySelector<HTMLElement>('[class*="__fullName"]');
  const arrow = anchor?.querySelector<HTMLElement>('[class*="__arrowBox"]');
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
  const search = document.createElement('input');
  search.className = 'nexora-market-preview-search';
  search.type = 'search';
  search.placeholder = 'Search all NEXORA Spot pairs (e.g. BTC, ETH, USDT)';
  search.setAttribute('aria-label', 'Search captured pairs');
  const columns = document.createElement('div');
  columns.className = 'nexora-market-preview-columns';
  columns.innerHTML = '<span>Pair</span><span>Captured price (USDT)</span><span>Precision</span>';
  const tabs = document.createElement('div');
  tabs.className = 'nexora-market-preview-tabs';
  const quoteTabs = ['All', 'USDT', 'USDC', 'ETH', 'BTC'];
  let activeQuote = 'All';
  const tabButtons = quoteTabs.map(quote => {
    const button = document.createElement('button');
    button.type = 'button'; button.textContent = quote;
    button.setAttribute('aria-pressed', String(quote === activeQuote));
    button.addEventListener('click', event => {
      event.stopPropagation(); activeQuote = quote; visibleLimit=120;
      tabButtons.forEach(b => b.setAttribute('aria-pressed', String(b.textContent === quote)));
      refresh();
    });
    tabs.append(button);
    return button;
  });
  const filterBar = document.createElement('div');
  filterBar.className = 'nexora-market-preview-filters';
  filterBar.textContent = 'All     Main';
  const choices = document.createElement('div');
  choices.className = 'nexora-market-preview-choices';
  choices.hidden = true; // Never show archived sample markets while live API loads.
  let selected = 'BTC_USDT';
  let liveMarkets:MexcSpotMarket[] = [];
  let liveLoaded=false;
  let visibleLimit=120;
  const showMore=document.createElement('button');
  showMore.type='button';showMore.className='nexora-market-show-more';showMore.hidden=true;
  const liveRows=document.createElement('div');
  liveRows.className='nexora-market-preview-choices';
  liveRows.setAttribute('aria-label','NEXORA live spot market prices');
  let sortKey: 'pair' | 'price' = 'pair';
  let sortDirection = 1;
  const buttons = CAPTURED_MARKETS.map(market => {
    const button = document.createElement('button');
    button.type = 'button';
    const display = capturedMarketDisplay(market.id);
    button.innerHTML = '<span></span><span></span><span></span>';
    button.children[0].textContent = market.symbol + '/USDT';
    button.children[1].textContent = display.formattedPrice;
    button.children[2].textContent = display.formattedPrecision;
    button.setAttribute('aria-label', market.symbol);
    button.setAttribute('aria-pressed', String(market.id === 'BTC_USDT'));
    button.addEventListener('click', event => { event.stopPropagation(); show(market.id); close(); });
    choices.append(button);
    return { id: market.id, button };
  });
  const sortButtons: HTMLButtonElement[] = [];
  for (const [key, text] of [['pair', 'Pair ↕'], ['price', 'Price ↕'], ['none', 'Change']] as const) {
    const button = document.createElement('button'); button.type = 'button';
    button.textContent = text; button.className = 'nexora-market-sort';
    if (key === 'none') button.disabled = true;
    else button.addEventListener('click', event => {
      event.stopPropagation();
      if (sortKey === key) sortDirection *= -1;
      else { sortKey = key; sortDirection = 1; }
      refresh();
    });
    columns.append(button); sortButtons.push(button);
  }
  columns.querySelectorAll('span').forEach(node => node.remove());
  function refresh() {
    const q = search.value.trim().toUpperCase();
    for (const { id, button } of buttons) {
      button.hidden = liveLoaded || (activeQuote !== 'All' && activeQuote !== 'USDT') || (q !== '' && !id.includes(q));
    }
    const sorted = [...buttons].sort((a,b) => {
      const v = sortKey === 'pair' ? a.id.localeCompare(b.id)
        : comparePrice(capturedMarketDisplay(a.id).price, capturedMarketDisplay(b.id).price);
      return sortDirection * v;
    });
    sorted.forEach(x => choices.append(x.button));
    liveRows.replaceChildren();
    const liveFiltered=liveMarkets.filter(m=>(activeQuote==='All'||m.quote===activeQuote) && (q==='' || m.symbol.includes(q) || m.quote.includes(q) || m.id.includes(q)));
    liveFiltered.sort((a,b)=>sortDirection*(sortKey==='pair'?a.symbol.localeCompare(b.symbol):comparePrice(a.price,b.price)));
    for(const market of liveFiltered.slice(0,visibleLimit)) {
      const row=document.createElement('button'); row.type='button';
      row.setAttribute('aria-label',market.symbol+'/'+market.quote);
      const cells=[market.symbol+'/'+market.quote,market.price?formatPrice(market.price):'—',market.change24h===null?'—':(market.change24h>0?'+':'')+market.change24h.toFixed(2)+'%'];
      for(const [index,value] of cells.entries()) {
        const span=document.createElement('span');
        if(index===0){
          span.className='nexora-market-pair';
          const logo=document.createElement('img');
          logo.className='nexora-market-logo';
          logo.alt='';
          logo.loading='lazy';
          logo.decoding='async';
          // Public icon asset; unknown/new tokens fall back to a neutral token avatar.
          logo.src='https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/'+market.symbol.toLowerCase()+'.svg';
          const fallback=document.createElement('span');
          fallback.className='nexora-market-logo-fallback';
          fallback.textContent=market.symbol.slice(0,1);
          fallback.hidden=true;
          logo.addEventListener('error',()=>{logo.hidden=true;fallback.hidden=false},{once:true});
          span.append(logo,fallback,document.createTextNode(value));
        }else{span.textContent=value;}
        row.append(span);
      }
      const changeCell=row.lastElementChild;
      if(changeCell&&market.change24h!==null)changeCell.className=market.change24h>0?'nexora-change-positive':market.change24h<0?'nexora-change-negative':'nexora-change-neutral';
      row.addEventListener('click', event=>{ event.stopPropagation();selectLive(market);close(); });
      liveRows.append(row);
    }
    showMore.hidden=liveFiltered.length<=visibleLimit;
    showMore.textContent='Show more markets ('+Math.min(visibleLimit,liveFiltered.length)+' / '+liveFiltered.length+')';
    const noResults = liveLoaded && liveRows.children.length===0;
    empty.hidden = !noResults;
    empty.textContent = 'No NEXORA Spot pairs match this filter';
    sortButtons.forEach((button,i) => button.setAttribute('aria-pressed', String(i === (sortKey === 'pair' ? 0 : 1))));
  }
  function comparePrice(a:string,b:string) {
    const norm = (x:string) => {
      const [whole, frac = ''] = x.split('.');
      return x ? BigInt(whole + frac.padEnd(30,'0')) : -1n;
    };
    const x=norm(a), y=norm(b);
    return x < y ? -1 : x > y ? 1 : 0;
  }
  const empty = document.createElement('div');
  empty.className = 'nexora-market-preview-empty';
  empty.textContent = 'Loading NEXORA Spot markets…';
  empty.hidden = false;
  search.addEventListener('input', () => {visibleLimit=120;refresh()});
  showMore.addEventListener('click',event=>{event.stopPropagation();visibleLimit+=120;refresh()});
  panel.append(search, tabs, filterBar, columns, liveRows, showMore, choices, empty);
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
  // Do not misrepresent saved BTC book/chart/order-entry numbers as another pair.
  const btcOnlyPanels = [
    root.querySelector<HTMLElement>('[class*="__chartWrapper"]'),
    root.querySelector<HTMLElement>('[class*="__orderbookDealsWrapper"]'),
    root.querySelector<HTMLElement>('[class*="__actionWrapper"]')
  ].filter((panel): panel is HTMLElement => panel !== null);
  const marketStatus = document.createElement('div');
  marketStatus.className = 'nexora-market-status';
  marketStatus.setAttribute('role', 'status');
  marketStatus.hidden = true;
  const headline = anchor.parentElement ?? anchor;
  headline.append(marketStatus);
  const setDataAvailability = (id: string, label: string) => {
    const unavailable = id !== 'BTC_USDT';
    for (const panel of btcOnlyPanels) {
      if (unavailable && panel.matches('[class*="__actionWrapper"]')) {
        panel.dataset.nexoraUnavailable = 'true';
        panel.dataset.nexoraUnavailableLabel = label + ' market data not connected';
      } else {
        delete panel.dataset.nexoraUnavailable;
        delete panel.dataset.nexoraUnavailableLabel;
      }
    }
    marketStatus.hidden = !unavailable;
    marketStatus.textContent = unavailable ? label + ' selected — NEXORA chart and depth (test only); trading disabled' : '';
  };
  function selectLive(market:MexcSpotMarket) {
    selected=market.id;
    const label=market.symbol+'/'+market.quote;
    if(titleNode) titleNode.textContent=label;
    if(subname) subname.textContent='NEXORA Spot · public ticker';
    root.dataset.localSelectedMarket=market.id;
    root.dataset.localMarketDataUnavailable='true';
    // Public market data can populate the chart/depth; forms stay unavailable.
    for(const panel of btcOnlyPanels) {
      const liveVisual=panel.matches('[class*="__chartWrapper"],[class*="__orderbookDealsWrapper"]');
      if(liveVisual){delete panel.dataset.nexoraUnavailable;delete panel.dataset.nexoraUnavailableLabel;}
    }
    root.dispatchEvent(new CustomEvent('nexora:market-selected',{detail:{symbol:market.id}}));
    buttons.forEach(choice=>choice.button.setAttribute('aria-pressed','false'));
  }
  let loadController:AbortController|null=null;
  let liveLoading=false;
  async function loadLive() {
    if(liveLoaded||liveLoading)return;
    loadController=new AbortController();liveLoading=true;
    panel.setAttribute('aria-busy','true');
    empty.hidden=false;
    empty.textContent='Loading NEXORA Spot markets…';
    try {
      liveMarkets=await getMexcSpotMarkets(loadController.signal);
      liveLoaded=true;
      panel.dataset.marketCount=String(liveMarkets.length);
      choices.hidden=true;
      refresh();
    } catch(error) {
      if(loadController.signal.aborted)return;
      empty.hidden=false;
      empty.textContent='Market data unavailable: '+(error instanceof Error?error.message:String(error));
      console.error('[NEXORA market catalog]',error);
    } finally {liveLoading=false;panel.removeAttribute('aria-busy')}
  }
  function show(id: 'BTC_USDT' | 'SHIDO_USDT' | 'WOJAK_USDT') {
    const item = capturedMarketDisplay(id);
    selected = id;
    buttons.forEach(choice => choice.button.setAttribute('aria-pressed', String(choice.id === id)));
    if (titleNode) titleNode.textContent = item.label;
    if (subname) subname.textContent = item.id === 'BTC_USDT' ? originalSubname : 'Offline sample';
    root.dataset.localSelectedMarket = id;
    root.dataset.localMarketDataUnavailable = String(id !== 'BTC_USDT');
    setDataAvailability(id, item.label);
    root.dispatchEvent(new CustomEvent('nexora:market-selected',{detail:{symbol:id.replace('_','')}}));
    refresh();
  }
  // Preserve the initial saved BTC heading without exposing offline sample rows.
  arrow?.setAttribute('role','button');
  arrow?.setAttribute('tabindex','0');
  arrow?.setAttribute('aria-label','Open spot market selector');
  const close = () => { panel.hidden = true; heading.setAttribute('aria-expanded', 'false'); };
  const toggle = (event?: Event) => { event?.stopPropagation(); if (panel.hidden) { positionPanel(); void loadLive(); } panel.hidden = !panel.hidden; heading.setAttribute('aria-expanded', String(!panel.hidden)); };
  const key = (event: KeyboardEvent) => {
    if (event.key === 'Escape') { close(); return; }
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggle(event); }
  };
  const outside = (event: MouseEvent) => {
    if (!panel.hidden && !anchor.contains(event.target as Node) && !panel.contains(event.target as Node)) close();
  };
  heading.addEventListener('click', toggle);
  arrow?.addEventListener('click', toggle);
  arrow?.addEventListener('keydown', key);
  heading.addEventListener('keydown', key);
  document.addEventListener('click', outside);
  return () => {
    heading.removeEventListener('click', toggle);
    arrow?.removeEventListener('click', toggle);
    arrow?.removeEventListener('keydown', key);
    heading.removeEventListener('keydown', key);
    document.removeEventListener('click', outside);
    heading.removeAttribute('role');
    heading.removeAttribute('tabindex');
    heading.removeAttribute('aria-label');
    heading.removeAttribute('aria-expanded');
    window.removeEventListener('resize', positionPanel);
    window.removeEventListener('scroll', positionPanel, true);
    arrow?.removeAttribute('role'); arrow?.removeAttribute('tabindex'); arrow?.removeAttribute('aria-label');
    if(titleNode) titleNode.textContent = originalHeading;
    if(subname) subname.textContent = originalSubname;
    delete root.dataset.localSelectedMarket;
    delete root.dataset.localMarketDataUnavailable;
    btcOnlyPanels.forEach(panel => { delete panel.dataset.nexoraUnavailable; delete panel.dataset.nexoraUnavailableLabel; });
    marketStatus.remove();
    loadController?.abort();
    panel.remove();
  };
}
