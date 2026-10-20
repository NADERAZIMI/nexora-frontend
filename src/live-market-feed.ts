/** Read-only MEXC public spot feed: never connects to trading/account endpoints. */
export interface DepthLevel { price:string; qty:string }
export interface Candle { time:number; open:number;high:number;low:number;close:number }
const valid=(v:unknown):v is string=>typeof v==='string' && /^\d+(?:\.\d+)?$/.test(v);
export async function fetchMarketFrame(symbol:string, signal:AbortSignal):Promise<{asks:DepthLevel[];bids:DepthLevel[];candles:Candle[]}> {
 if(!/^[A-Z0-9]{3,30}$/.test(symbol))throw Error('Invalid market symbol');
 const base='/mexc-public/api/v3/';
 const get=async(path:string)=>{const r=await fetch(base+path,{signal,credentials:'omit'});if(!r.ok)throw Error('MEXC '+r.status+' '+r.statusText+' ('+path.split('?')[0]+')');const data=await r.json() as unknown;if(data&&typeof data==='object'&&'code' in data&&data.code!==200&&data.code!==0)throw Error('MEXC API '+String(data.code));return data};
 const [depthResult, candlesResult] = await Promise.allSettled([
   get('depth?symbol='+symbol+'&limit=20'),
   get('klines?symbol='+symbol+'&interval=1m&limit=120')
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
 if(!asks.length&&!bids.length&&!candles.length)throw Error('No usable market depth or candles');
 return {asks,bids,candles};
}
export function attachReadOnlyMarketFeed(root:HTMLElement){
 const chart=root.querySelector<HTMLElement>('[class*="__chartWrapper"]');
 const book=root.querySelector<HTMLElement>('[class*="__orderbookDealsWrapper"]');
 if(!chart||!book)return ()=>{};
 const overlay=document.createElement('div');overlay.className='nexora-live-chart';overlay.hidden=true;
 const label=document.createElement('div');label.className='nexora-live-chart-label';
 const canvas=document.createElement('canvas');canvas.setAttribute('aria-label','MEXC 1-minute candlestick chart (read-only)');
 const state=document.createElement('div');state.className='nexora-live-state';const retry=document.createElement('button');retry.type='button';retry.className='nexora-feed-retry';retry.textContent='Retry';retry.hidden=true;retry.addEventListener('click',()=>{void refresh()});overlay.append(label,canvas,state,retry);chart.append(overlay);
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
  for(const side of ['asks','bids']) for(const row of book.querySelectorAll<HTMLElement>('[class*="__'+side+'Wrapper"] [class*="__tableRow"]'))row.style.visibility='hidden';
  if(price)price.textContent='—';
  const ctx=canvas.getContext('2d');ctx?.clearRect(0,0,canvas.width,canvas.height);
  try{
   const frame=await fetchMarketFrame(selected,signal);if(signal.aborted||!mounted)return;
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
   if(price){const last=frame.candles.at(-1);price.textContent=last?String(last.close):(frame.bids[0]?.price??frame.asks[0]?.price??'—');}
   paint(frame.candles);
   retry.hidden=true;
   state.textContent=selected+' · MEXC public · '+(frame.candles.length?'1m candles':'candles unavailable')+' · '+(frame.asks.length+frame.bids.length?'depth snapshot':'depth unavailable')+' · no trading';
  }catch(e){if(signal.aborted||!mounted)return;const message=e instanceof Error?e.message:String(e);state.textContent='MEXC feed failed: '+message;retry.hidden=false;console.warn('[NEXORA public market feed]',message);}
 };
 const choose=(event:Event)=>{
   const id=(event as CustomEvent<{symbol:string}>).detail?.symbol;
   if(!id||!/^[A-Z0-9]{3,30}$/.test(id))return;
   selected=id;restore();overlay.hidden=false;label.textContent=id+' · MEXC spot (live read-only)';
   if(interval!==undefined)clearInterval(interval);
   void refresh();interval=window.setInterval(()=>{void refresh()},15000);
 };
 const zoom=(event:WheelEvent)=>{if(overlay.hidden)return;event.preventDefault();scale=Math.max(.5,Math.min(5,scale*(event.deltaY<0?1.15:.87)));};
 root.addEventListener('nexora:market-selected',choose);
 canvas.addEventListener('wheel',zoom,{passive:false});
 return ()=>{mounted=false;controller?.abort();if(interval!==undefined)clearInterval(interval);restore();overlay.remove();root.removeEventListener('nexora:market-selected',choose);canvas.removeEventListener('wheel',zoom)};
}
