/** Read-only public Spot ticker for the headline. */
type Ticker={symbol?:string;lastPrice?:string;priceChangePercent?:string;highPrice?:string;lowPrice?:string;volume?:string;quoteVolume?:string};
const num=(v:unknown)=>typeof v==='string'&&v.trim()!==''&&Number.isFinite(Number(v))?Number(v):null;
const price=(v:number)=>new Intl.NumberFormat('en-US',{maximumFractionDigits:v>=100?2:v>=1?4:8,minimumFractionDigits:v>=100?2:0}).format(v);
const compact=(v:number)=>new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:2}).format(v);
export function attachSpotHeaderLive(root:HTMLElement):()=>void{
 const headline=root.querySelector<HTMLElement>('[class*="__gridLayoutHeadline"]');
 if(!headline)return ()=>{};
 const nodes=(key:string)=>Array.from(headline.querySelectorAll<HTMLElement>('[data-hl-'+key+']'));
 const fields={price:nodes('price'),rate:nodes('rate'),high:nodes('high'),low:nodes('low'),vol:nodes('vol'),amount:nodes('amount')};
 const volumeLabel=fields.vol[0]?.closest<HTMLElement>('[class*="__leftItem"]')?.querySelector<HTMLElement>('[class*="__withBorder"]');
 const amountLabel=fields.amount[0]?.closest<HTMLElement>('[class*="__leftItem"]')?.querySelector<HTMLElement>('[class*="__withBorder"]');
 const usdPrice=headline.querySelector<HTMLElement>('[class*="__priceBox"] [dir="ltr"] > [dir="ltr"]');
 let symbol='BTCUSDT',base='BTC',quote='USDT',disposed=false;
 let socket:WebSocket|null=null,reconnect:number|undefined,ping:number|undefined,attempt=0,lastMessage=0;
 const clear=(state:string)=>{headline.dataset.nexoraHeaderFeed=state;for(const entries of Object.values(fields))for(const el of entries)el.textContent='—';if(usdPrice)usdPrice.textContent='—'};
 const render=(item:Record<string,unknown>)=>{
  const id=String(item.symbol??'');
  if(id!==symbol)return;
  const last=num(item.lastPrice),ratio=num(item.price24hPcnt),high=num(item.highPrice24h),low=num(item.lowPrice24h),vol=num(item.volume24h),amount=num(item.turnover24h);
  if(last===null||last<=0||ratio===null||high===null||low===null||vol===null||amount===null||high<low||low<=0||vol<0||amount<0)return;
  const change=ratio*100;
  const put=(key:keyof typeof fields,value:string)=>fields[key].forEach(el=>{el.textContent=value});
  put('price',price(last));put('rate',(change>0?'+':'')+change.toFixed(2)+'%');
  put('high',price(high));put('low',price(low));put('vol',compact(vol));put('amount',compact(amount));
  for(const el of fields.rate){const up=el.dataset.hlUpCls,down=el.dataset.hlDownCls;if(up)el.classList.toggle(up,change>=0);if(down)el.classList.toggle(down,change<0)}
  const priceBox=fields.price[0]?.closest<HTMLElement>('[data-hl-price-color]');
  if(priceBox){const up=priceBox.dataset.hlUpCls,down=priceBox.dataset.hlDownCls;if(up)priceBox.classList.toggle(up,change>=0);if(down)priceBox.classList.toggle(down,change<0)}
  if(usdPrice)usdPrice.textContent=['USDT','USDC','USD'].includes(quote)?price(last):'—';
  if(volumeLabel)volumeLabel.textContent='24H Volume ('+base+')';
  if(amountLabel)amountLabel.textContent='24H Amount ('+quote+')';
  lastMessage=Date.now();headline.dataset.nexoraHeaderFeed='live';
  root.dispatchEvent(new CustomEvent('nexora:live-ticker',{detail:{symbol:id,price:last,change24h:change,receivedAt:lastMessage,source:'bybit',category:'spot'}}));
 };
 const subscribe=()=>{
  if(socket?.readyState===WebSocket.OPEN)socket.send(JSON.stringify({op:'subscribe',args:['tickers.'+symbol]}));
 };
 const connect=()=>{
  if(disposed)return;
  if(reconnect!==undefined){clearTimeout(reconnect);reconnect=undefined}
  if(ping!==undefined){clearInterval(ping);ping=undefined}
  if(socket){socket.onclose=null;socket.close();socket=null}
  clear('loading');
  const ws=new WebSocket('wss://stream.bybit.com/v5/public/spot');
  socket=ws;
  ws.onopen=()=>{
   if(disposed||socket!==ws)return;
   attempt=0;subscribe();
   ping=window.setInterval(()=>{if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify({op:'ping'}))},20000);
  };
  ws.onmessage=(event:MessageEvent)=>{
   if(disposed||socket!==ws)return;
   try{
    const msg=JSON.parse(String(event.data)) as {topic?:string;data?:Record<string,unknown>|Record<string,unknown>[]};
    if(msg.topic!=='tickers.'+symbol)return;
    const item=Array.isArray(msg.data)?msg.data[0]:msg.data;
    if(item&&typeof item==='object')render(item);
   }catch{/* Discard malformed public WS frame. */}
  };
  ws.onerror=()=>{if(socket===ws)headline.dataset.nexoraHeaderFeed='connecting'};
  ws.onclose=()=>{
   if(disposed||socket!==ws)return;
   socket=null;if(ping!==undefined){clearInterval(ping);ping=undefined}
   clear('unavailable');
   reconnect=window.setTimeout(connect,Math.min(30000,1000*2**Math.min(attempt++,5)));
  };
 };
 const onMarket=(ev:Event)=>{
  const d=(ev as CustomEvent<{symbol?:string;base?:string;quote?:string}>).detail;
  if(!d?.symbol)return;
  const next=d.symbol.replaceAll('_','').toUpperCase();
  if(!/^[A-Z0-9]{3,30}$/.test(next))return;
  const previous=symbol;symbol=next;
  base=d.base??(next.endsWith('USDT')?next.slice(0,-4):base);
  quote=d.quote??(next.endsWith('USDT')?'USDT':quote);
  clear('loading');
  if(volumeLabel)volumeLabel.textContent='24H Volume ('+base+')';
  if(amountLabel)amountLabel.textContent='24H Amount ('+quote+')';
  if(socket?.readyState===WebSocket.OPEN){
   socket.send(JSON.stringify({op:'unsubscribe',args:['tickers.'+previous]}));subscribe();
  }else if(!socket||socket.readyState===WebSocket.CLOSED)connect();
 };
 root.addEventListener('nexora:market-selected',onMarket);connect();
 const watchdog=window.setInterval(()=>{if(disposed)return;if(lastMessage&&Date.now()-lastMessage>30000){lastMessage=0;connect()}},5000);
 return ()=>{
  disposed=true;clearInterval(watchdog);
  if(reconnect!==undefined)clearTimeout(reconnect);
  if(ping!==undefined)clearInterval(ping);
  if(socket){socket.onclose=null;socket.close()}
  root.removeEventListener('nexora:market-selected',onMarket);
 };
}
