/** Bybit V5 public Spot orderbook. Snapshot before deltas; no trading endpoints. */
type Packet={topic?:string;type?:string;data?:{s?:string;b?:unknown;a?:unknown;u?:number;seq?:number}};
type Level=[string,string];
const validLevels=(input:unknown):Level[]=>Array.isArray(input)?input.filter((x):x is Level=>Array.isArray(x)&&x.length>=2&&typeof x[0]==='string'&&typeof x[1]==='string'&&Number.isFinite(Number(x[0]))&&Number(x[0])>0&&Number.isFinite(Number(x[1]))&&Number(x[1])>=0):[];
export function attachBybitSpotOrderbook(root:HTMLElement):()=>void{
 const book=root.querySelector<HTMLElement>('[class*="__orderbookDealsWrapper"]');
 if(!book)return ()=>{};
 const asksHost=book.querySelector<HTMLElement>('[class*="__asksWrapper"]');
 const bidsHost=book.querySelector<HTMLElement>('[class*="__bidsWrapper"]');
 const center=book.querySelector<HTMLElement>('[class*="__newPrice"]');
 const centerPrice=center?.querySelector<HTMLElement>('[class*="__bigPrice"] [class*="__priceEllipsis"] > div');
 const fiat=center?.querySelector<HTMLElement>('[class*="__fiatPrice"] [dir="ltr"] > [dir="ltr"]');
 if(!asksHost||!bidsHost)return ()=>{};
 const asksRows=Array.from(asksHost.querySelectorAll<HTMLElement>('[class*="__tableRow"]'));
 const bidsRows=Array.from(bidsHost.querySelectorAll<HTMLElement>('[class*="__tableRow"]'));
 const status=document.createElement('span');status.className='nexora-bybit-native-status';
 status.setAttribute('role','status');status.textContent='Connecting to NEXORA market…';
 book.querySelector<HTMLElement>('[class*="__controller"]')?.append(status);
 const originalPrice=centerPrice?.textContent??'';
 const originalFiat=fiat?.textContent??'';
 let symbol='BTCUSDT',ws:WebSocket|null=null,disposed=false,retry:number|undefined,ping:number|undefined,renderTimer:number|undefined,attempt=0;
 let snapshot=false,lastSeq=-1,lastUpdate=-1,lastFrame=0;
 const bidMap=new Map<string,string>(),askMap=new Map<string,string>();
 const reset=()=>{
  bidMap.clear();askMap.clear();snapshot=false;lastSeq=-1;lastUpdate=-1;
  for(const row of [...asksRows,...bidsRows])row.style.visibility='hidden';
  if(centerPrice)centerPrice.textContent='—';if(fiat)fiat.textContent='—';
  status.textContent='Connecting to NEXORA market…';book.dataset.nexoraDepthState='connecting';
 };
 const update=(map:Map<string,string>,levels:Level[])=>{for(const [p,q] of levels){if(Number(q)===0)map.delete(p);else map.set(p,q)}};
 const format=(v:string)=>Number(v).toLocaleString('en-US',{maximumFractionDigits:8});
 const draw=()=>{
  if(!snapshot)return;
  const renderSide=(rows:HTMLElement[],map:Map<string,string>,descending:boolean)=>{
   const levels=[...map.entries()].sort((a,b)=>descending?Number(b[0])-Number(a[0]):Number(a[0])-Number(b[0])).slice(0,rows.length);
   let cumulative=0;
   rows.forEach((row,i)=>{
    const level=levels[i];row.style.visibility=level?'visible':'hidden';
    if(!level)return;
    const [p,q]=level;cumulative+=Number(p)*Number(q);
    const priceEl=row.querySelector<HTMLElement>('[class*="__orderbookItem"] > [class*="__price"]');
    const qtyEl=row.querySelector<HTMLElement>('[class*="__orderbookItem"] > [class*="__vol"] span');
    const sumEl=row.querySelector<HTMLElement>('[class*="__orderbookItem"] > [class*="__amount"] span');
    if(priceEl)priceEl.textContent=format(p);
    if(qtyEl)qtyEl.textContent=format(q);
    if(sumEl)sumEl.textContent=cumulative.toLocaleString('en-US',{maximumFractionDigits:2});
    const bar=row.querySelector<HTMLElement>('[class*="__bar"]');
    if(bar)bar.style.transform='scaleX('+Math.min(1,Number(q)/Math.max(1,...levels.map(x=>Number(x[1]))))+')';
   });
  };
  renderSide(asksRows,askMap,false);renderSide(bidsRows,bidMap,true);
  const bestBid=Math.max(0,...[...bidMap.keys()].map(Number));
  const bestAsk=Math.min(Infinity,...[...askMap.keys()].map(Number));
  const mid=bestBid>0&&Number.isFinite(bestAsk)?(bestBid+bestAsk)/2:bestBid||bestAsk;
  if(Number.isFinite(mid)&&mid>0){
   if(centerPrice)centerPrice.textContent=mid.toLocaleString('en-US',{maximumFractionDigits:8});
   if(fiat)fiat.textContent=mid.toLocaleString('en-US',{maximumFractionDigits:8});
  }
  status.textContent='NEXORA Spot';book.dataset.nexoraDepthState='live';
 };
 const scheduleRender=()=>{if(renderTimer!==undefined)return;renderTimer=window.setTimeout(()=>{renderTimer=undefined;draw()},90)};
 const connect=()=>{
  if(disposed)return;
  if(retry!==undefined){clearTimeout(retry);retry=undefined}
  if(ping!==undefined){clearInterval(ping);ping=undefined}
  if(ws){ws.onclose=null;ws.close()}
  reset();
  const current=new WebSocket('wss://stream.bybit.com/v5/public/spot');ws=current;
  current.onopen=()=>{
   if(disposed||ws!==current)return;
   attempt=0;current.send(JSON.stringify({op:'subscribe',args:['orderbook.50.'+symbol]}));
   ping=window.setInterval(()=>{if(current.readyState===WebSocket.OPEN)current.send(JSON.stringify({op:'ping'}))},20000);
  };
  current.onmessage=(e:MessageEvent)=>{
   if(disposed||ws!==current)return;
   let pkt:Packet;try{pkt=JSON.parse(String(e.data)) as Packet}catch{return}
   if(pkt.topic!=='orderbook.50.'+symbol||!pkt.data||pkt.data.s!==symbol)return;
   const d=pkt.data;
   if(!Number.isSafeInteger(d.u)||!Number.isSafeInteger(d.seq))return;
   if(pkt.type==='snapshot'||d.u===1){
    bidMap.clear();askMap.clear();
    update(bidMap,validLevels(d.b));update(askMap,validLevels(d.a));
    snapshot=true;lastSeq=d.seq!;lastUpdate=d.u!;lastFrame=Date.now();scheduleRender();return;
   }
   if(pkt.type!=='delta'||!snapshot)return;
   if(d.seq!<=lastSeq||d.u!<=lastUpdate)return;
   // Bybit update IDs are monotonically increasing but not guaranteed contiguous.
   update(bidMap,validLevels(d.b));update(askMap,validLevels(d.a));
   lastSeq=d.seq!;lastUpdate=d.u!;lastFrame=Date.now();scheduleRender();
  };
  current.onerror=()=>{if(ws===current)status.textContent='NEXORA market connection interrupted'};
  current.onclose=()=>{
   if(disposed||ws!==current)return;
   ws=null;if(ping!==undefined){clearInterval(ping);ping=undefined}
   reset();status.textContent='NEXORA order book reconnecting…';
   retry=window.setTimeout(connect,Math.min(30000,1000*2**Math.min(attempt++,5)));
  };
 };
 const onMarket=(event:Event)=>{
  const d=(event as CustomEvent<{symbol?:string;category?:string}>).detail;
  if(!d?.symbol||d.category&&d.category!=='spot')return;
  const next=d.symbol.replaceAll('_','').toUpperCase();
  if(!/^[A-Z0-9]{3,30}$/.test(next)||next===symbol)return;
  symbol=next;connect();
 };
 root.addEventListener('nexora:market-selected',onMarket);
 connect();
 const watchdog=window.setInterval(()=>{if(snapshot&&lastFrame&&Date.now()-lastFrame>30000)connect()},5000);
 return ()=>{disposed=true;root.removeEventListener('nexora:market-selected',onMarket);clearInterval(watchdog);if(retry!==undefined)clearTimeout(retry);if(ping!==undefined)clearInterval(ping);if(renderTimer!==undefined)clearTimeout(renderTimer);if(ws){ws.onclose=null;ws.close()}status.remove();if(centerPrice)centerPrice.textContent=originalPrice;if(fiat)fiat.textContent=originalFiat;for(const row of [...asksRows,...bidsRows])row.style.visibility=''};
}
