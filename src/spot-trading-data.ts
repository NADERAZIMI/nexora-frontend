/** NEXORA Spot Trading Data: observed public MEXC aggregate trades, not actual capital inflows. */
type Trade={p?:unknown;q?:unknown;T?:unknown;m?:unknown};
type Bucket={buy:number;sell:number;count:number};
const intervals=[['15m',15],['30m',30],['1H',60],['2H',120],['4H',240],['1D',1440]] as const;
const usd=(n:number)=>new Intl.NumberFormat('en-US',{notation:'compact',maximumFractionDigits:2}).format(n);
export function attachSpotTradingData(root:HTMLElement):()=>void{
 const chart=root.querySelector<HTMLElement>('[class*="__chartWrapper"]');
 if(!chart)return ()=>{};
 const tabs=Array.from(chart.querySelectorAll<HTMLElement>('[role="tab"]'));
 const trading=tabs.find(t=>t.textContent?.trim()==='Trading Data');
 const chartTab=tabs.find(t=>t.textContent?.trim()==='Chart');
 if(!trading||!chartTab)return ()=>{};
 const host=document.createElement('section');host.className='nexora-trading-data';host.hidden=true;chart.append(host);
 let active=false,selected='BTCUSDT',base='BTC',quote='USDT',controller:AbortController|null=null,interval='1D';
 const sum=(items:Bucket[])=>items.reduce((a,b)=>({buy:a.buy+b.buy,sell:a.sell+b.sell,count:a.count+b.count}),{buy:0,sell:0,count:0});
 const add=(tag:string,cls:string,text:string,parent:HTMLElement)=>{const el=document.createElement(tag);el.className=cls;el.textContent=text;parent.append(el);return el};
 const message=(text:string)=>{host.replaceChildren();add('p','nexora-trading-note',text,host)};
 const showData=(trades:{price:number;quantity:number;time:number;buyerMaker:boolean}[])=>{
  host.replaceChildren();
  add('div','nexora-trading-intro','Observed MEXC Spot trades · '+base+'/'+quote,host);
  const grid=add('div','nexora-trading-grid','',host);
  const left=add('div','nexora-trading-column','',grid);
  add('h3','','Fund Flow Analysis (sampled trades)',left);
  const nav=add('div','nexora-trading-intervals','',left);
  const period=intervals.find(x=>x[0]===interval)?.[1]??1440;
  for(const [label] of intervals){
   const button=document.createElement('button');button.textContent=label;button.type='button';
   button.className=label===interval?'is-active':'';
   button.addEventListener('click',()=>{interval=label;showData(trades)});
   nav.append(button);
  }
  const cutoff=Date.now()-period*60000;
  const sample=trades.filter(t=>t.time>=cutoff);
  const totals={buy:0,sell:0,count:0};
  for(const t of sample){const v=t.price*t.quantity;if(t.buyerMaker)totals.sell+=v;else totals.buy+=v;totals.count++}
  const sumValue=totals.buy+totals.sell;
  const percent=sumValue>0?100*totals.buy/sumValue:0;
  const circle=add('div','nexora-trading-donut','',left);
  circle.style.background=sumValue>0?'conic-gradient(#16b89a 0% '+percent+'%,#f05a70 '+percent+'% 100%)':'#323845';
  add('span','',''+(sumValue?percent.toFixed(1)+'% buy':'No trades'),circle);
  const table=add('div','nexora-trading-table','',left);
  for(const [name,v] of [['Buyer-initiated',totals.buy],['Seller-initiated',totals.sell],['Buy − Sell',totals.buy-totals.sell]] as [string,number][]){
    const row=add('div','nexora-trading-row','',table);add('span','',name,row);
    add('strong',v>=0?'nexora-flow-buy':'nexora-flow-sell',usd(v)+' '+quote,row);
  }
  const right=add('div','nexora-trading-column','',grid);
  add('h3','','Sampled Trade Activity',right);
  const buckets:Array<Bucket>=Array.from({length:8},()=>({buy:0,sell:0,count:0}));
  if(sample.length){
   const min=Math.min(...sample.map(t=>t.time)),max=Math.max(...sample.map(t=>t.time))+1;
   for(const t of sample){const idx=Math.min(7,Math.floor((t.time-min)/(max-min)*8));const v=t.price*t.quantity;
     if(t.buyerMaker)buckets[idx].sell+=v;else buckets[idx].buy+=v;buckets[idx].count++}
  }
  const highest=Math.max(1,...buckets.map(x=>Math.max(x.buy,x.sell)));
  const bars=add('div','nexora-trading-bars','',right);
  for(const [i,b] of buckets.entries()){
   const group=add('div','nexora-trading-bar-group','',bars);
   for(const [kind,value] of [['buy',b.buy],['sell',b.sell]] as const){
    const bar=add('div','nexora-trading-bar '+kind,'',group);
    bar.style.height=Math.max(1,value/highest*125)+'px';bar.title=kind+': '+usd(value)+' '+quote;
   }
   add('small','',String(i+1),group);
  }
  const all=sum(buckets);
  add('h3','','Net Aggressor Balance',right);
  add('div',(all.buy-all.sell)>=0?'nexora-flow-buy':'nexora-flow-sell',''+usd(all.buy-all.sell)+' '+quote,right);
  const first=trades[0]?.time,last=trades.at(-1)?.time;
  const range=first&&last?new Date(first).toLocaleString()+' – '+new Date(last).toLocaleString():'Unavailable';
  add('p','nexora-trading-note','Based on '+trades.length+' most recent aggregated trades; coverage: '+range+'. Buyer/seller classification uses maker side. This is sampled trade imbalance, NOT actual capital inflow or complete 24h / 5-day market flow.',right);
  add('p','nexora-trading-note','Five-day institutional flow and big/medium/small trade classifications require complete historical trade coverage and are not inferred from a limited public sample.',right);
 };
 const load=async()=>{
  controller?.abort();controller=new AbortController();const signal=controller.signal;const id=selected;
  message('Loading observed Spot trades…');
  try{
   const response=await fetch('/mexc-public/api/v3/aggTrades?symbol='+encodeURIComponent(id)+'&limit=1000',{signal,credentials:'omit'});
   if(!response.ok)throw new Error('HTTP '+response.status);
   const data=await response.json() as unknown;
   if(!Array.isArray(data))throw new Error('Unexpected trade response');
   const trades=data.flatMap((t:Trade)=>{
    const price=Number(t.p),quantity=Number(t.q),time=Number(t.T);
    return Number.isFinite(price)&&price>0&&Number.isFinite(quantity)&&quantity>0&&Number.isFinite(time)&&typeof t.m==='boolean'
     ?[{price,quantity,time,buyerMaker:t.m}]:[];
   }).sort((a,b)=>a.time-b.time);
   if(signal.aborted||!active||id!==selected)return;
   if(!trades.length){message('No public aggregated trades available for '+base+'/'+quote);return}
   showData(trades);
  }catch(error){if(signal.aborted||!active)return;message('Trading data unavailable: '+(error instanceof Error?error.message:String(error)));}
 };
 const onClick=(event:MouseEvent)=>{
  const target=event.target;if(!(target instanceof Element))return;
  const tab=tabs.find(t=>t.contains(target));if(!tab)return;
  if(tab===trading){
   event.preventDefault();event.stopImmediatePropagation();
   active=true;host.hidden=false;chart.dataset.nexoraTradingOpen='true';
   root.dispatchEvent(new Event('nexora:close-market-picker'));
   for(const t of tabs){t.setAttribute('aria-selected',String(t===trading));t.parentElement?.classList.toggle('ant-tabs-v2-tab-active',t===trading)}
   void load();
  }else{
   active=false;host.hidden=true;delete chart.dataset.nexoraTradingOpen;controller?.abort();
  }
 };
 const onMarket=(event:Event)=>{
  const detail=(event as CustomEvent<{symbol?:string;base?:string;quote?:string}>).detail;
  if(!detail?.symbol)return;selected=detail.symbol;base=detail.base||'BTC';quote=detail.quote||'USDT';
  if(active)void load();
 };
 root.addEventListener('click',onClick,true);root.addEventListener('nexora:market-selected',onMarket);
 return ()=>{controller?.abort();host.remove();root.removeEventListener('click',onClick,true);root.removeEventListener('nexora:market-selected',onMarket)};
}
