import { createInteractiveSpotChart } from './interactive-chart';
import { attachChartTypePicker } from './chart-type-picker';
/** Read-only MEXC public spot feed: never connects to trading/account endpoints. */
export interface DepthLevel { price:string; qty:string }
export interface Candle { time:number; open:number;high:number;low:number;close:number;volume:number }
const TIMEFRAMES=['1m','3m','5m','10m','15m','30m','60m','2h','4h','6h','8h','12h','1d','2d','3d','5d','1W','1M'] as const;
type Timeframe=typeof TIMEFRAMES[number];
const derived:Partial<Record<Timeframe,{source:string;minutes:number}>>={
 '3m':{source:'1m',minutes:3},'10m':{source:'5m',minutes:10},
 '2h':{source:'60m',minutes:120},'6h':{source:'60m',minutes:360},
 '8h':{source:'4h',minutes:480},'12h':{source:'4h',minutes:720},
 '2d':{source:'1d',minutes:2880},'3d':{source:'1d',minutes:4320},
 '5d':{source:'1d',minutes:7200}
};
function aggregateCandles(rows:Candle[],periodMinutes:number):Candle[]{
 const period=periodMinutes*60000;
 const ordered=rows.slice().sort((a,b)=>a.time-b.time);
 const result:Candle[]=[];
 for(const bar of ordered){
  const start=Math.floor(bar.time/period)*period;
  const prev=result[result.length-1];
  if(prev&&prev.time===start){prev.high=Math.max(prev.high,bar.high);prev.low=Math.min(prev.low,bar.low);prev.close=bar.close;prev.volume+=bar.volume;}
  else result.push({time:start,open:bar.open,high:bar.high,low:bar.low,close:bar.close,volume:bar.volume});
 }
 return result;
}
const valid=(v:unknown):v is string=>typeof v==='string' && /^\d+(?:\.\d+)?$/.test(v);
export async function fetchMarketFrame(symbol:string, signal:AbortSignal, timeframe:Timeframe='1m'):Promise<{asks:DepthLevel[];bids:DepthLevel[];candles:Candle[];lastPrice:string}> {
 if(!/^[A-Z0-9]{3,30}$/.test(symbol))throw Error('Invalid market symbol');
 const base='/mexc-public/api/v3/';
 const get=async(path:string)=>{const r=await fetch(base+path,{signal,credentials:'omit'});if(!r.ok)throw Error('MEXC '+r.status+' '+r.statusText+' ('+path.split('?')[0]+')');const data=await r.json() as unknown;if(data&&typeof data==='object'&&'code' in data&&data.code!==200&&data.code!==0)throw Error('MEXC API '+String(data.code));return data};
 const conversion=derived[timeframe];
 const [depthResult, candlesResult, tickerResult] = await Promise.allSettled([
   get('depth?symbol='+symbol+'&limit=20'),
   get('klines?symbol='+symbol+'&interval='+(conversion?.source??timeframe)+'&limit=240'),
   get('ticker/price?symbol='+symbol)
 ]);
 if(depthResult.status==='rejected'&&candlesResult.status==='rejected') {
   throw Error('Market depth and candles unavailable: '+String(depthResult.reason));
 }
 const depth=depthResult.status==='fulfilled'?depthResult.value:null;
 const klines=candlesResult.status==='fulfilled'?candlesResult.value:null;
 const levels=(rows:unknown[]):DepthLevel[]=>rows.filter((row):row is [string,string]=>Array.isArray(row)&&valid(row[0])&&valid(row[1])).slice(0,9).map(row=>({price:row[0],qty:row[1]}));
 const asks=depth&&typeof depth==='object'&&'asks' in depth&&Array.isArray(depth.asks)?levels(depth.asks):[];
 const bids=depth&&typeof depth==='object'&&'bids' in depth&&Array.isArray(depth.bids)?levels(depth.bids):[];
 const candles:Candle[]=Array.isArray(klines)?klines.filter((row):row is [number,string,string,string,string,string]=>Array.isArray(row)&&typeof row[0]==='number'&&row.slice(1,6).every(valid)).map(row=>({time:row[0],open:Number(row[1]),high:Number(row[2]),low:Number(row[3]),close:Number(row[4]),volume:Number(row[5])})).filter(x=>Object.values(x).every(Number.isFinite)&&x.low>0):[];
 const preparedCandles=conversion?aggregateCandles(candles,conversion.minutes):candles;
 const ticker=tickerResult.status==='fulfilled'?tickerResult.value:null;
 const lastPrice=ticker&&typeof ticker==='object'&&'price' in ticker&&valid(ticker.price)?ticker.price:'';
 if(!asks.length&&!bids.length&&!candles.length&&!lastPrice)throw Error('No usable MEXC market data');
 return {asks,bids,candles:preparedCandles,lastPrice};
}
export function attachReadOnlyMarketFeed(root:HTMLElement){
 const chart=root.querySelector<HTMLElement>('[class*="__chartWrapper"]');
 const book=root.querySelector<HTMLElement>('[class*="__orderbookDealsWrapper"]');
 if(!chart||!book)return ()=>{};
 const overlay=document.createElement('div');overlay.className='nexora-live-chart';overlay.hidden=true;
 overlay.classList.add('nexora-embedded-kline');
 const embedded=document.createElement('iframe');
 embedded.className='nexora-embedded-kline-frame';
 embedded.title='NEXORA Spot candlestick chart and indicators';
 embedded.setAttribute('loading','eager');
 embedded.setAttribute('referrerpolicy','same-origin');
 embedded.src='/kline-preview.html?embedded=1&symbol=BTCUSDT';
 overlay.append(embedded);
 const label=document.createElement('div');label.className='nexora-live-chart-label';
 const canvas=document.createElement('canvas');canvas.setAttribute('aria-label','Spot chart');
 const state=document.createElement('div');state.className='nexora-live-state';const retry=document.createElement('button');retry.type='button';retry.className='nexora-feed-retry';retry.textContent='Retry';retry.hidden=true;retry.addEventListener('click',()=>{void refresh()});overlay.append(label,canvas,state,retry);chart.append(overlay);
 const toolbar=document.createElement('div');toolbar.className='nexora-chart-timeframes';toolbar.setAttribute('aria-label','Chart timeframe');
 const LABELS:Record<Timeframe,string>={'1m':'1m','3m':'3m','5m':'5m','10m':'10m','15m':'15m','30m':'30m','60m':'1H','2h':'2H','4h':'4H','6h':'6H','8h':'8H','12h':'12H','1d':'1D','2d':'2D','3d':'3D','5d':'5D','1W':'1W','1M':'1M'};
 const DEFAULT_PINNED:Timeframe[]=['1m','5m','15m','30m','60m','4h','1d'];
 const saved=(()=>{try{const raw=JSON.parse(localStorage.getItem('nexora-spot-pinned-timeframes')||'[]') as unknown;return Array.isArray(raw)?TIMEFRAMES.filter(t=>raw.includes(t)):[]}catch{return []}})();
 let pinned:Timeframe[]=saved.length?saved:DEFAULT_PINNED.slice();
 let timeframe:Timeframe='15m',latestCandles:Candle[]=[],editing=false;
 let draftPinned:Timeframe[]=pinned.slice();
 const menu=document.createElement('div');menu.className='nexora-timeframe-menu';menu.hidden=true;
 const persist=()=>{try{localStorage.setItem('nexora-spot-pinned-timeframes',JSON.stringify(pinned))}catch{/* optional browser preference */}};
 const selectTimeframe=(tf:Timeframe)=>{
  if(timeframe!==tf){timeframe=tf;scale=1;void refresh();}
  renderToolbar();renderMenu();
 };
 const renderToolbar=()=>{
  toolbar.replaceChildren();
  for(const tf of pinned){
   const button=document.createElement('button');button.type='button';button.textContent=LABELS[tf];button.dataset.timeframe=tf;
   button.setAttribute('aria-pressed',String(tf===timeframe));
   button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();selectTimeframe(tf)});
   toolbar.append(button);
  }
  const toggle=document.createElement('button');toggle.type='button';toggle.className='nexora-timeframe-toggle';
  toggle.textContent='▴';toggle.setAttribute('aria-label','Choose and edit chart timeframes');
  toggle.setAttribute('aria-expanded',String(!menu.hidden));
  toggle.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();if(!menu.hidden&&editing){editing=false;draftPinned=pinned.slice();}menu.hidden=!menu.hidden;renderToolbar();renderMenu()});
  toolbar.append(toggle);
 };
 const renderMenu=()=>{
  menu.replaceChildren();
  const visiblePinned=editing?draftPinned:pinned;
  const top=document.createElement('div');top.className='nexora-timeframe-menu-top';
  const title=document.createElement('span');title.textContent='Pinned';
  const edit=document.createElement('button');edit.type='button';edit.textContent=editing?'Save':'Edit';
  edit.addEventListener('click',event=>{event.stopPropagation();if(editing){pinned=draftPinned.slice();persist();editing=false;renderToolbar();}else{draftPinned=pinned.slice();editing=true;}renderMenu()});
  top.append(title,edit);if(editing){const cancel=document.createElement('button');cancel.type='button';cancel.textContent='Cancel';cancel.addEventListener('click',event=>{event.stopPropagation();editing=false;draftPinned=pinned.slice();renderMenu()});top.append(cancel)}menu.append(top);
  const pinnedGrid=document.createElement('div');pinnedGrid.className='nexora-timeframe-grid';menu.append(pinnedGrid);
  for(const tf of visiblePinned){
   const btn=document.createElement('button');btn.type='button';btn.className=tf===timeframe?'is-active':'';
   btn.textContent=LABELS[tf];
   if(editing){btn.classList.add('can-remove');const mark=document.createElement('span');mark.className='nexora-timeframe-mark remove';mark.textContent='−';btn.append(mark)}btn.setAttribute('aria-label',(editing?'Unpin ':'Select ')+LABELS[tf]);
   btn.addEventListener('click',event=>{
    event.stopPropagation();
    if(editing){if(draftPinned.length>1){draftPinned=draftPinned.filter(t=>t!==tf);renderMenu();}}
    else{selectTimeframe(tf);menu.hidden=true;renderToolbar();}
   });
   pinnedGrid.append(btn);
  }
  const subtitle=document.createElement('div');subtitle.className='nexora-timeframe-subtitle';subtitle.textContent='Available';menu.append(subtitle);
  const grid=document.createElement('div');grid.className='nexora-timeframe-grid';menu.append(grid);
  for(const tf of TIMEFRAMES.filter(t=>!visiblePinned.includes(t))){
   const btn=document.createElement('button');btn.type='button';btn.textContent=LABELS[tf];
   if(editing){btn.classList.add('can-add');const mark=document.createElement('span');mark.className='nexora-timeframe-mark add';mark.textContent='+';btn.append(mark)}
   btn.addEventListener('click',event=>{
    event.stopPropagation();
    if(editing){draftPinned=TIMEFRAMES.filter(t=>draftPinned.includes(t)||t===tf);renderMenu();}
    else{selectTimeframe(tf);menu.hidden=true;renderToolbar();}
   });grid.append(btn);
  }
 };
 const topRow=document.createElement('div');topRow.className='nexora-chart-top-row';topRow.append(toolbar);
 overlay.prepend(topRow,menu);renderToolbar();renderMenu();
 const price=book.querySelector<HTMLElement>('[class*="__newPrice"] [class*="__priceEllipsis"] > div');
 const originalPrice=price?.textContent??'';
 const originals: {node:HTMLElement;text:string}[]=[];
 for(const side of ['asks','bids'])for(const row of book.querySelectorAll<HTMLElement>('[class*="__'+side+'Wrapper"] [class*="__tableRow"]')){
  for(const key of ['price','vol','amount']){
   const parent=row.querySelector<HTMLElement>('[class*="__orderbookItem"] > [class*="__'+key+'"]');
   const node=key==='price'?parent:(parent?.querySelector<HTMLElement>('span')??parent);
   if(node)originals.push({node,text:node.textContent??''});
  }
 }
 let controller:AbortController|null=null, interval:number|undefined,selected='BTCUSDT',mounted=true,scale=1;
 let mostRecentTickerAt=0;
 const restore=()=>{originals.forEach(x=>{x.node.textContent=x.text});if(price)price.textContent=originalPrice};
 const interactive=createInteractiveSpotChart(canvas,topRow);
 const disposeChartTypePicker=attachChartTypePicker(topRow,type=>interactive.setChartType(type as Parameters<typeof interactive.setChartType>[0]));
 const paint=(candles:Candle[])=>interactive.setCandles(candles);
 const refresh=async()=>{
  controller?.abort();controller=new AbortController();const signal=controller.signal;
  retry.hidden=true;state.textContent='Loading '+selected+' live market data…';

  try{
   const frame=await fetchMarketFrame(selected,signal,timeframe);if(signal.aborted||!mounted)return;
   const paintSide=(side:'asks'|'bids',levels:DepthLevel[])=>{
    const rows=Array.from(book.querySelectorAll<HTMLElement>('[class*="__'+side+'Wrapper"] [class*="__tableRow"]'));
    rows.forEach((row,i)=>{const data=levels[i];row.style.visibility=data?'visible':'hidden';if(!data)return;
      const p=row.querySelector<HTMLElement>('[class*="__orderbookItem"] > [class*="__price"]');
      const q=row.querySelector<HTMLElement>('[class*="__orderbookItem"] > [class*="__vol"] span');
      const t=row.querySelector<HTMLElement>('[class*="__orderbookItem"] > [class*="__amount"] span');
      if(p)p.textContent=data.price;if(q)q.textContent=data.qty;if(t)t.textContent='—';
    });
   };
   paintSide('asks',frame.asks);paintSide('bids',frame.bids);
   if(price&&Date.now()-mostRecentTickerAt>6000){const last=frame.candles.at(-1);price.textContent=frame.lastPrice||(last?String(last.close):(frame.bids[0]?.price??frame.asks[0]?.price??'—'));}
   latestCandles=frame.candles;
   paint(latestCandles);
   const tick=Number(frame.lastPrice);interactive.setLivePrice(Number.isFinite(tick)&&tick>0?tick:null);
   retry.hidden=true;
   state.textContent='';
  }catch(e){if(signal.aborted||!mounted)return;const message=e instanceof Error?e.message:String(e);state.textContent='NEXORA market feed unavailable: '+message.replaceAll('MEXC','market');retry.hidden=false;console.warn('[NEXORA public market feed]',message);}
 };
 const choose=(event:Event)=>{
   const id=(event as CustomEvent<{symbol:string}>).detail?.symbol;
   if(!id||!/^[A-Z0-9]{3,30}$/.test(id))return;
   selected=id;mostRecentTickerAt=0;
   if(embedded.contentWindow)embedded.contentWindow.postMessage({type:'nexora:chart-market',symbol:id},location.origin);
   if(!embedded.contentWindow||embedded.dataset.loaded!=='true')embedded.src='/kline-preview.html?embedded=1&symbol='+encodeURIComponent(id);
   latestCandles=[];interactive.setCandles([],true);restore();overlay.hidden=false;label.textContent='' ;
   for(const side of ['asks','bids'])for(const row of book.querySelectorAll<HTMLElement>('[class*="__'+side+'Wrapper"] [class*="__tableRow"]'))row.style.visibility='hidden';
   if(price)price.textContent='—';
   const ctx=canvas.getContext('2d');ctx?.clearRect(0,0,canvas.width,canvas.height);
   if(interval!==undefined)clearInterval(interval);
   void refresh();interval=window.setInterval(()=>{void refresh()},15000);
 };
 embedded.addEventListener('load',()=>{embedded.dataset.loaded='true';embedded.contentWindow?.postMessage({type:'nexora:chart-market',symbol:selected},location.origin);});
 const onTicker=(event:Event)=>{
  const detail=(event as CustomEvent<{symbol?:string;price?:number}>).detail;
  if(!detail||detail.symbol!==selected||typeof detail.price!=='number'||!Number.isFinite(detail.price)||detail.price<=0)return;
  mostRecentTickerAt=Date.now();
  if(price)price.textContent=detail.price.toLocaleString('en-US',{maximumFractionDigits:detail.price>=100?2:8});
  interactive.setLivePrice(detail.price);
 };
 root.addEventListener('nexora:live-ticker',onTicker);
 root.addEventListener('nexora:market-selected',choose);
 const dismiss=(event:PointerEvent)=>{if(!menu.hidden&&!menu.contains(event.target as Node)&&!toolbar.contains(event.target as Node)){menu.hidden=true;renderToolbar()}};
 document.addEventListener('pointerdown',dismiss);
 // Show verified public BTC candles immediately instead of the archived static chart.
 choose(new CustomEvent('nexora:market-selected',{detail:{symbol:'BTCUSDT'}}));
 return ()=>{mounted=false;controller?.abort();if(interval!==undefined)clearInterval(interval);restore();overlay.remove();root.removeEventListener('nexora:market-selected',choose);root.removeEventListener('nexora:live-ticker',onTicker);interactive.dispose();disposeChartTypePicker();document.removeEventListener('pointerdown',dismiss)};
}
