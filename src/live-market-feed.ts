/** Read-only MEXC public spot feed: never connects to trading/account endpoints. */
export interface DepthLevel { price:string; qty:string }
export interface Candle { time:number; open:number;high:number;low:number;close:number }
const TIMEFRAMES=['1m','5m','15m','30m','60m','4h','1d','1W','1M'] as const;
type Timeframe=typeof TIMEFRAMES[number];
const valid=(v:unknown):v is string=>typeof v==='string' && /^\d+(?:\.\d+)?$/.test(v);
export async function fetchMarketFrame(symbol:string, signal:AbortSignal, timeframe:Timeframe='1m'):Promise<{asks:DepthLevel[];bids:DepthLevel[];candles:Candle[];lastPrice:string}> {
 if(!/^[A-Z0-9]{3,30}$/.test(symbol))throw Error('Invalid market symbol');
 const base='/mexc-public/api/v3/';
 const get=async(path:string)=>{const r=await fetch(base+path,{signal,credentials:'omit'});if(!r.ok)throw Error('MEXC '+r.status+' '+r.statusText+' ('+path.split('?')[0]+')');const data=await r.json() as unknown;if(data&&typeof data==='object'&&'code' in data&&data.code!==200&&data.code!==0)throw Error('MEXC API '+String(data.code));return data};
 const [depthResult, candlesResult, tickerResult] = await Promise.allSettled([
   get('depth?symbol='+symbol+'&limit=20'),
   get('klines?symbol='+symbol+'&interval='+timeframe+'&limit=240'),
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
 const candles:Candle[]=Array.isArray(klines)?klines.filter((row):row is [number,string,string,string,string]=>Array.isArray(row)&&typeof row[0]==='number'&&row.slice(1,5).every(valid)).map(row=>({time:row[0],open:Number(row[1]),high:Number(row[2]),low:Number(row[3]),close:Number(row[4])})).filter(x=>Object.values(x).every(Number.isFinite)&&x.low>0):[];
 const ticker=tickerResult.status==='fulfilled'?tickerResult.value:null;
 const lastPrice=ticker&&typeof ticker==='object'&&'price' in ticker&&valid(ticker.price)?ticker.price:'';
 if(!asks.length&&!bids.length&&!candles.length&&!lastPrice)throw Error('No usable MEXC market data');
 return {asks,bids,candles,lastPrice};
}
export function attachReadOnlyMarketFeed(root:HTMLElement){
 const chart=root.querySelector<HTMLElement>('[class*="__chartWrapper"]');
 const book=root.querySelector<HTMLElement>('[class*="__orderbookDealsWrapper"]');
 if(!chart||!book)return ()=>{};
 const overlay=document.createElement('div');overlay.className='nexora-live-chart';overlay.hidden=true;
 const label=document.createElement('div');label.className='nexora-live-chart-label';
 const canvas=document.createElement('canvas');canvas.setAttribute('aria-label','NEXORA spot candlestick chart');
 const state=document.createElement('div');state.className='nexora-live-state';const retry=document.createElement('button');retry.type='button';retry.className='nexora-feed-retry';retry.textContent='Retry';retry.hidden=true;retry.addEventListener('click',()=>{void refresh()});overlay.append(label,canvas,state,retry);chart.append(overlay);
 const toolbar=document.createElement('div');toolbar.className='nexora-chart-timeframes';toolbar.setAttribute('aria-label','Chart timeframe');
 const LABELS:Record<Timeframe,string>={'1m':'1m','5m':'5m','15m':'15m','30m':'30m','60m':'1H','4h':'4H','1d':'1D','1W':'1W','1M':'1M'};
 const DEFAULT_PINNED:Timeframe[]=['1m','5m','15m','30m','60m','4h','1d'];
 const saved=(()=>{try{const raw=JSON.parse(localStorage.getItem('nexora-spot-pinned-timeframes')||'[]') as unknown;return Array.isArray(raw)?TIMEFRAMES.filter(t=>raw.includes(t)):[]}catch{return []}})();
 let pinned:Timeframe[]=saved.length?saved:DEFAULT_PINNED.slice();
 let timeframe:Timeframe='15m',latestCandles:Candle[]=[],editing=false;
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
  toggle.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();menu.hidden=!menu.hidden;renderToolbar();renderMenu()});
  toolbar.append(toggle);
 };
 const renderMenu=()=>{
  menu.replaceChildren();
  const top=document.createElement('div');top.className='nexora-timeframe-menu-top';
  const title=document.createElement('span');title.textContent='Pinned';
  const edit=document.createElement('button');edit.type='button';edit.textContent=editing?'Done':'Edit';
  edit.addEventListener('click',event=>{event.stopPropagation();editing=!editing;renderMenu()});
  top.append(title,edit);menu.append(top);
  const pinnedGrid=document.createElement('div');pinnedGrid.className='nexora-timeframe-grid';menu.append(pinnedGrid);
  for(const tf of pinned){
   const btn=document.createElement('button');btn.type='button';btn.className=tf===timeframe?'is-active':'';
   btn.textContent=(editing?'− ':'')+LABELS[tf];btn.setAttribute('aria-label',(editing?'Unpin ':'Select ')+LABELS[tf]);
   btn.addEventListener('click',event=>{
    event.stopPropagation();
    if(editing){if(pinned.length>1){pinned=pinned.filter(t=>t!==tf);persist();renderToolbar();renderMenu();}}
    else{selectTimeframe(tf);menu.hidden=true;renderToolbar();}
   });
   pinnedGrid.append(btn);
  }
  const subtitle=document.createElement('div');subtitle.className='nexora-timeframe-subtitle';subtitle.textContent='Available';menu.append(subtitle);
  const grid=document.createElement('div');grid.className='nexora-timeframe-grid';menu.append(grid);
  for(const tf of TIMEFRAMES.filter(t=>!pinned.includes(t))){
   const btn=document.createElement('button');btn.type='button';btn.textContent=(editing?'+ ':'')+LABELS[tf];
   btn.addEventListener('click',event=>{
    event.stopPropagation();
    if(editing){pinned=TIMEFRAMES.filter(t=>pinned.includes(t)||t===tf);persist();renderToolbar();renderMenu();}
    else{selectTimeframe(tf);menu.hidden=true;renderToolbar();}
   });grid.append(btn);
  }
  const unavailable=document.createElement('p');unavailable.className='nexora-timeframe-hint';
  unavailable.textContent='Other reference intervals are not supported by the current MEXC Spot candle feed.';
  menu.append(unavailable);
 };
 overlay.prepend(toolbar,menu);renderToolbar();renderMenu();
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
 const restore=()=>{originals.forEach(x=>{x.node.textContent=x.text});if(price)price.textContent=originalPrice};
 const paint=(candles:Candle[])=>{
  const width=Math.max(250,canvas.clientWidth),height=Math.max(180,canvas.clientHeight),dpr=window.devicePixelRatio||1;
  canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
  const ctx=canvas.getContext('2d');if(!ctx)return;ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.clearRect(0,0,width,height);
  const selectedBars=candles.slice(-Math.max(15,Math.floor(80/scale)));
  if(!selectedBars.length)return;
  const min=Math.min(...selectedBars.map(c=>c.low)),max=Math.max(...selectedBars.map(c=>c.high)),span=max-min||max*.0001||1;
  const y=(v:number)=>14+(max-v)/span*(height-30);
  const step=width/selectedBars.length;
  ctx.strokeStyle='#292c32';ctx.lineWidth=1;
  for(let i=1;i<5;i++){let yy=height*i/5;ctx.beginPath();ctx.moveTo(0,yy);ctx.lineTo(width,yy);ctx.stroke()}
  selectedBars.forEach((c,i)=>{const green=c.close>=c.open;ctx.fillStyle=ctx.strokeStyle=green?'#16B89A':'#F05A70';const x=i*step+step/2;ctx.beginPath();ctx.moveTo(x,y(c.low));ctx.lineTo(x,y(c.high));ctx.stroke();const top=Math.min(y(c.open),y(c.close)),bottom=Math.max(y(c.open),y(c.close));ctx.fillRect(x-Math.max(1,step*.3),top,Math.max(2,step*.6),Math.max(1,bottom-top))});
 };
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
   if(price){const last=frame.candles.at(-1);price.textContent=frame.lastPrice||(last?String(last.close):(frame.bids[0]?.price??frame.asks[0]?.price??'—'));}
   latestCandles=frame.candles;
   paint(latestCandles);
   retry.hidden=true;
   state.textContent='';
  }catch(e){if(signal.aborted||!mounted)return;const message=e instanceof Error?e.message:String(e);state.textContent='NEXORA market feed unavailable: '+message.replaceAll('MEXC','market');retry.hidden=false;console.warn('[NEXORA public market feed]',message);}
 };
 const choose=(event:Event)=>{
   const id=(event as CustomEvent<{symbol:string}>).detail?.symbol;
   if(!id||!/^[A-Z0-9]{3,30}$/.test(id))return;
   selected=id;latestCandles=[];restore();overlay.hidden=false;label.textContent='' ;
   for(const side of ['asks','bids'])for(const row of book.querySelectorAll<HTMLElement>('[class*="__'+side+'Wrapper"] [class*="__tableRow"]'))row.style.visibility='hidden';
   if(price)price.textContent='—';
   const ctx=canvas.getContext('2d');ctx?.clearRect(0,0,canvas.width,canvas.height);
   if(interval!==undefined)clearInterval(interval);
   void refresh();interval=window.setInterval(()=>{void refresh()},15000);
 };
 const zoom=(event:WheelEvent)=>{if(overlay.hidden)return;event.preventDefault();scale=Math.max(.5,Math.min(5,scale*(event.deltaY<0?1.15:.87)));paint(latestCandles);};
 root.addEventListener('nexora:market-selected',choose);
 canvas.addEventListener('wheel',zoom,{passive:false});
 const dismiss=(event:PointerEvent)=>{if(!menu.hidden&&!menu.contains(event.target as Node)&&!toolbar.contains(event.target as Node)){menu.hidden=true;renderToolbar()}};
 document.addEventListener('pointerdown',dismiss);
 const resize=()=>{if(!overlay.hidden&&latestCandles.length)paint(latestCandles)};
 window.addEventListener('resize',resize);
 // Show verified public BTC candles immediately instead of the archived static chart.
 choose(new CustomEvent('nexora:market-selected',{detail:{symbol:'BTCUSDT'}}));
 return ()=>{mounted=false;controller?.abort();if(interval!==undefined)clearInterval(interval);restore();overlay.remove();root.removeEventListener('nexora:market-selected',choose);canvas.removeEventListener('wheel',zoom);window.removeEventListener('resize',resize);document.removeEventListener('pointerdown',dismiss)};
}
