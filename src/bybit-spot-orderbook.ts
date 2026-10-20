/** Bybit V5 public Spot orderbook. Snapshot before deltas; no trading endpoints. */
type Packet={topic?:string;type?:string;data?:{s?:string;b?:unknown;a?:unknown;u?:number;seq?:number}};
type Level=[string,string];
const validLevels=(input:unknown):Level[]=>Array.isArray(input)?input.filter((x):x is Level=>Array.isArray(x)&&x.length>=2&&typeof x[0]==='string'&&typeof x[1]==='string'&&Number.isFinite(Number(x[0]))&&Number(x[0])>0&&Number.isFinite(Number(x[1]))&&Number(x[1])>=0):[];
export function attachBybitSpotOrderbook(root:HTMLElement):()=>void{
 const book=root.querySelector<HTMLElement>('[class*="__orderbookDealsWrapper"]');
 if(!book)return ()=>{};
 const panel=document.createElement('div');panel.className='nexora-bybit-book-live';
 const status=document.createElement('div');status.className='nexora-bybit-book-status';status.setAttribute('role','status');
 const layout=document.createElement('div');layout.className='nexora-bybit-book-layout';
 const asks=document.createElement('div'),bids=document.createElement('div');
 asks.className='nexora-bybit-book-side asks';bids.className='nexora-bybit-book-side bids';
 layout.append(asks,bids);panel.append(status,layout);book.append(panel);
 let symbol='BTCUSDT',ws:WebSocket|null=null,disposed=false,retry:number|undefined,ping:number|undefined,renderTimer:number|undefined,attempt=0;
 let snapshot=false,lastSeq=-1,lastUpdate=-1,lastFrame=0;
 const bidMap=new Map<string,string>(),askMap=new Map<string,string>();
 const reset=()=>{bidMap.clear();askMap.clear();snapshot=false;lastSeq=-1;lastUpdate=-1;asks.replaceChildren();bids.replaceChildren();status.textContent='Connecting to Bybit Spot order book…';panel.dataset.state='connecting'};
 const update=(map:Map<string,string>,levels:Level[])=>{for(const [p,q] of levels){if(Number(q)===0)map.delete(p);else map.set(p,q)}};
 const draw=()=>{
  if(!snapshot)return;
  const renderSide=(host:HTMLElement,map:Map<string,string>,descending:boolean)=>{
   const rows=[...map.entries()].sort((a,b)=>descending?Number(b[0])-Number(a[0]):Number(a[0])-Number(b[0])).slice(0,12);
   const fragment=document.createDocumentFragment();let cumulative=0;
   for(const [p,q] of rows){
    cumulative+=Number(p)*Number(q);
    const row=document.createElement('div');row.className='nexora-bybit-depth-row';
    const price=document.createElement('span');price.className='price';price.textContent=p;
    const qty=document.createElement('span');qty.textContent=q;
    const total=document.createElement('span');total.textContent=new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(cumulative);
    row.append(price,qty,total);fragment.append(row);
   }
   host.replaceChildren(fragment);
  };
  renderSide(asks,askMap,false);renderSide(bids,bidMap,true);
  status.textContent='NEXORA · Bybit Spot · '+symbol;
  panel.dataset.state='live';
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
   // A non-consecutive update ID indicates missed depth changes: reconnect for a new snapshot.
   if(d.u!==lastUpdate+1){connect();return}
   update(bidMap,validLevels(d.b));update(askMap,validLevels(d.a));
   lastSeq=d.seq!;lastUpdate=d.u!;lastFrame=Date.now();scheduleRender();
  };
  current.onerror=()=>{if(ws===current)status.textContent='Bybit order book connection interrupted'};
  current.onclose=()=>{
   if(disposed||ws!==current)return;
   ws=null;if(ping!==undefined){clearInterval(ping);ping=undefined}
   reset();status.textContent='Bybit order book reconnecting…';
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
 const onMode=()=>{panel.dataset.mode=book.dataset.localOrderbookMode||'combined'};
 const observer=new MutationObserver(onMode);observer.observe(book,{attributes:true,attributeFilter:['data-local-orderbook-mode']});onMode();
 root.addEventListener('nexora:market-selected',onMarket);
 connect();
 const watchdog=window.setInterval(()=>{if(snapshot&&lastFrame&&Date.now()-lastFrame>30000)connect()},5000);
 return ()=>{disposed=true;root.removeEventListener('nexora:market-selected',onMarket);observer.disconnect();clearInterval(watchdog);if(retry!==undefined)clearTimeout(retry);if(ping!==undefined)clearInterval(ping);if(renderTimer!==undefined)clearTimeout(renderTimer);if(ws){ws.onclose=null;ws.close()}panel.remove()};
}
