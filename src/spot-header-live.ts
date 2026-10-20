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
 let symbol='BTCUSDT',base='BTC',quote='USDT',disposed=false,ctrl:AbortController|null=null;
 const clear=(status:string)=>{headline.dataset.nexoraHeaderFeed=status;for(const entries of Object.values(fields))for(const el of entries)el.textContent='—';if(usdPrice)usdPrice.textContent='—'};
 const refresh=async()=>{
  ctrl?.abort();ctrl=new AbortController();const signal=ctrl.signal,id=symbol;
  try{
   const r=await fetch('/mexc-public/api/v3/ticker/24hr?symbol='+encodeURIComponent(id),{signal,credentials:'omit',cache:'no-store'});
   if(!r.ok)throw Error('HTTP '+r.status);
   const raw:unknown=await r.json();
   const item=(Array.isArray(raw)?raw.find(x=>x?.symbol===id):raw) as Ticker|null;
   if(!item||typeof item!=='object'||item.symbol!==id)throw Error('Invalid ticker');
   const v=[num(item.lastPrice),num(item.priceChangePercent),num(item.highPrice),num(item.lowPrice),num(item.volume),num(item.quoteVolume)];
   if(v.some(x=>x===null)||v[0]!<=0||v[2]!<v[3]!||v[3]!<=0)throw Error('Incomplete ticker');
   if(disposed||signal.aborted||id!==symbol)return;
   const [last,change,high,low,vol,amount]=v as number[];
   const put=(key:keyof typeof fields,text:string)=>fields[key].forEach(el=>{el.textContent=text});
   put('price',price(last));put('rate',(change>0?'+':'')+change.toFixed(2)+'%');
   put('high',price(high));put('low',price(low));put('vol',compact(vol));put('amount',compact(amount));
   for(const el of fields.rate){
    const up=el.dataset.hlUpCls,down=el.dataset.hlDownCls;
    if(up)el.classList.toggle(up,change>=0);
    if(down)el.classList.toggle(down,change<0);
   }
   const priceColor=fields.price[0]?.closest<HTMLElement>('[data-hl-price-color]');
   if(priceColor){const up=priceColor.dataset.hlUpCls,down=priceColor.dataset.hlDownCls;if(up)priceColor.classList.toggle(up,change>=0);if(down)priceColor.classList.toggle(down,change<0)}
   if(usdPrice)usdPrice.textContent=['USDT','USDC','USD'].includes(quote)?price(last):'—';
   if(volumeLabel)volumeLabel.textContent='24H Volume ('+base+')';
   if(amountLabel)amountLabel.textContent='24H Amount ('+quote+')';
   headline.dataset.nexoraHeaderFeed='live';
  }catch(e){if(disposed||signal.aborted||id!==symbol)return;clear('unavailable');console.warn('[NEXORA] Spot headline ticker unavailable',e)}
 };
 const onMarket=(ev:Event)=>{
  const d=(ev as CustomEvent<{symbol?:string;base?:string;quote?:string}>).detail;
  if(!d?.symbol)return;const next=d.symbol.replaceAll('_','').toUpperCase();
  if(!/^[A-Z0-9]{3,30}$/.test(next))return;
  symbol=next;base=d.base??(next.endsWith('USDT')?next.slice(0,-4):base);quote=d.quote??(next.endsWith('USDT')?'USDT':quote);
  clear('loading');if(volumeLabel)volumeLabel.textContent='24H Volume ('+base+')';if(amountLabel)amountLabel.textContent='24H Amount ('+quote+')';void refresh();
 };
 root.addEventListener('nexora:market-selected',onMarket);clear('loading');void refresh();
 const timer=window.setInterval(()=>{void refresh()},15000);
 return ()=>{disposed=true;ctrl?.abort();clearInterval(timer);root.removeEventListener('nexora:market-selected',onMarket)};
}
