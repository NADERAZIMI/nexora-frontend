/** Read-only MEXC public spot feed: never connects to trading/account endpoints. */
export interface DepthLevel { price:string; qty:string }
export interface Candle { time:number; open:number;high:number;low:number;close:number }
const valid=(v:unknown):v is string=>typeof v==='string' && /^\d+(?:\.\d+)?$/.test(v);
export async function fetchMarketFrame(symbol:string, signal:AbortSignal):Promise<{asks:DepthLevel[];bids:DepthLevel[];candles:Candle[]}> {
 if(!/^[A-Z0-9]{3,30}$/.test(symbol))throw Error('Invalid market symbol');
 const base='/mexc-public/api/v3/';
 const get=async(path:string)=>{const r=await fetch(base+path,{signal,credentials:'omit'});if(!r.ok)throw Error('MEXC market feed HTTP '+r.status);return r.json() as Promise<unknown>};
 const [depth,klines]=await Promise.all([get('depth?symbol='+symbol+'&limit=20'),get('klines?symbol='+symbol+'&interval=1m&limit=120')]);
 if(!depth||typeof depth!=='object'||!('asks' in depth)||!('bids' in depth)||!Array.isArray(depth.asks)||!Array.isArray(depth.bids))throw Error('Invalid depth data');
 const levels=(rows:unknown[]):DepthLevel[]=>rows.filter((row):row is [string,string]=>Array.isArray(row)&&valid(row[0])&&valid(row[1])).slice(0,9).map(row=>({price:row[0],qty:row[1]}));
 if(!Array.isArray(klines))throw Error('Invalid candles');
 const candles:Candle[]=klines.filter((row):row is [number,string,string,string,string]=>Array.isArray(row)&&typeof row[0]==='number'&&row.slice(1,5).every(valid)).map(row=>({time:row[0],open:Number(row[1]),high:Number(row[2]),low:Number(row[3]),close:Number(row[4])})).filter(x=>Object.values(x).every(Number.isFinite)&&x.low>0);
 return {asks:levels(depth.asks),bids:levels(depth.bids),candles};
}
export function attachReadOnlyMarketFeed(root:HTMLElement){
 const chart=root.querySelector<HTMLElement>('[class*="__chartWrapper"]');
 const book=root.querySelector<HTMLElement>('[class*="__orderbookDealsWrapper"]');
 if(!chart||!book)return ()=>{};
 const overlay=document.createElement('div');overlay.className='nexora-live-chart';overlay.hidden=true;
 const label=document.createElement('div');label.className='nexora-live-chart-label';
 const canvas=document.createElement('canvas');canvas.setAttribute('aria-label','MEXC 1-minute candlestick chart (read-only)');
 const state=document.createElement('div');state.className='nexora-live-state';overlay.append(label,canvas,state);chart.append(overlay);
 const price=book.querySelector<HTMLElement>('[class*="__newPrice"] [class*="__bigPrice"]');
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
  state.textContent='Loading MEXC public market data…';
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
   if(price&&frame.candles.length)price.textContent=frame.candles.at(-1)!.close.toString();
   paint(frame.candles);
   state.textContent='Public MEXC data · 1m candles · depth snapshot · no trading';
  }catch(e){if(signal.aborted||!mounted)return;state.textContent='Live market unavailable — check network or API region';}
 };
 const choose=(event:Event)=>{
   const id=(event as CustomEvent<{symbol:string}>).detail?.symbol;
   if(!id||!/^[A-Z0-9]{3,30}$/.test(id))return;
   selected=id;restore();overlay.hidden=false;label.textContent=id+' · MEXC spot (test feed)';
   if(interval!==undefined)clearInterval(interval);
   void refresh();interval=window.setInterval(()=>{void refresh()},15000);
 };
 const zoom=(event:WheelEvent)=>{if(overlay.hidden)return;event.preventDefault();scale=Math.max(.5,Math.min(5,scale*(event.deltaY<0?1.15:.87)));};
 root.addEventListener('nexora:market-selected',choose);
 canvas.addEventListener('wheel',zoom,{passive:false});
 return ()=>{mounted=false;controller?.abort();if(interval!==undefined)clearInterval(interval);restore();overlay.remove();root.removeEventListener('nexora:market-selected',choose);canvas.removeEventListener('wheel',zoom)};
}
