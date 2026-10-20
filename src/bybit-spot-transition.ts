/** NEXORA Spot market selector backed by Bybit V5 public instruments and tickers. */
type Instrument={symbol:string;baseCoin:string;quoteCoin:string;status:string};
type Ticker={symbol:string;lastPrice?:string;price24hPcnt?:string};
type Page={retCode:number;result?:{list?:Instrument[];nextPageCursor?:string}};
type Tickers={retCode:number;result?:{list?:Ticker[]}};
export function attachBybitSpotTransition(root:HTMLElement):()=>void{
 const chart=root.querySelector<HTMLElement>('[class*="__chartWrapper"]');
 const name=root.querySelector<HTMLElement>('[class*="__symbolInfoBox"] h1');
 const clickable=root.querySelector<HTMLElement>('[class*="__symbolInfoBox"] [class*="__bigName"]');
 const label=root.querySelector<HTMLElement>('[class*="__fullName"]');
 const placeholder=document.createElement('div');placeholder.className='nexora-bybit-pending nexora-bybit-chart-pending';
 placeholder.textContent='NEXORA · Chart integration in progress';chart?.append(placeholder);
 const panel=document.createElement('section');panel.className='nexora-spot-market-picker';panel.hidden=true;
 panel.setAttribute('aria-label','NEXORA Spot markets');
 const input=document.createElement('input');input.type='search';input.placeholder='Search Spot markets';input.setAttribute('aria-label','Search Spot markets');
 const tabs=document.createElement('div');tabs.className='nexora-spot-market-tabs';
 const headings=document.createElement('div');headings.className='nexora-spot-market-headings';headings.innerHTML='<span>Pair</span><span>Last Price</span><span>24h Change</span>';
 const rows=document.createElement('div');rows.className='nexora-spot-market-rows';
 const state=document.createElement('div');state.className='nexora-spot-market-state';state.setAttribute('role','status');
 panel.append(input,tabs,headings,rows,state);document.body.append(panel);
 let disposed=false,loading=false,loaded=false,filter='All',limit=100,controller:AbortController|null=null;
 let instruments:Instrument[]=[],prices=new Map<string,Ticker>();
 const quotes=['All','USDT','USDC','BTC','ETH'];
 const safe=(v:unknown):v is string=>typeof v==='string'&&/^[A-Z0-9]{3,35}$/.test(v);
 const number=(v:unknown)=>typeof v==='string'&&v.trim()!==''&&Number.isFinite(Number(v))?Number(v):null;
 const format=(v:string|undefined)=>{const n=number(v);return n!==null&&n>0?new Intl.NumberFormat('en-US',{maximumFractionDigits:n>=100?2:n>=1?4:8}).format(n):'—'};
 const choose=(m:Instrument)=>{
  if(name)name.textContent=m.baseCoin+'/'+m.quoteCoin;
  if(label)label.textContent='NEXORA Spot';
  panel.hidden=true;
  root.dispatchEvent(new CustomEvent('nexora:market-selected',{detail:{symbol:m.symbol,base:m.baseCoin,quote:m.quoteCoin,category:'spot'}}));
 };
 const draw=()=>{
  if(disposed)return;
  const query=input.value.trim().toUpperCase();
  const list=instruments.filter(m=>(filter==='All'||m.quoteCoin===filter)&&(!query||m.symbol.includes(query)||m.baseCoin.includes(query)));
  rows.replaceChildren();
  for(const m of list.slice(0,limit)){
   const row=document.createElement('button');row.type='button';row.className='nexora-spot-market-row';
   const pair=document.createElement('span');pair.textContent=m.baseCoin+'/'+m.quoteCoin;
   const ticker=prices.get(m.symbol),last=document.createElement('span'),change=document.createElement('span');
   last.textContent=format(ticker?.lastPrice);
   const n=number(ticker?.price24hPcnt);
   change.textContent=n===null?'—':(n>0?'+':'')+(n*100).toFixed(2)+'%';
   change.className=n===null?'':n>=0?'up':'down';
   row.append(pair,last,change);row.addEventListener('click',()=>choose(m));rows.append(row);
  }
  state.textContent=list.length?'Showing '+Math.min(limit,list.length)+' of '+list.length+' Spot pairs':'No matching Spot markets';
  if(list.length>limit){const more=document.createElement('button');more.className='nexora-spot-market-more';more.textContent='Show more';more.addEventListener('click',()=>{limit+=100;draw()});rows.append(more)}
 };
 for(const quote of quotes){const b=document.createElement('button');b.type='button';b.textContent=quote;b.addEventListener('click',()=>{filter=quote;limit=100;for(const el of tabs.querySelectorAll('button'))el.setAttribute('aria-pressed',String(el===b));draw()});b.setAttribute('aria-pressed',String(quote==='All'));tabs.append(b)}
 const load=async()=>{
  if(loaded||loading)return;
  controller?.abort();controller=new AbortController();const signal=controller.signal;loading=true;state.textContent='Loading NEXORA Spot markets…';
  try{
   let cursor='',all:Instrument[]=[];
   for(let page=0;page<8;page++){
    const query=new URLSearchParams({category:'spot',limit:'1000'});if(cursor)query.set('cursor',cursor);
    const response=await fetch('https://api.bybit.com/v5/market/instruments-info?'+query,{signal,credentials:'omit'});
    if(!response.ok)throw Error('Market catalog HTTP '+response.status);
    const data=await response.json() as Page;
    if(data.retCode!==0||!Array.isArray(data.result?.list))throw Error('Invalid market catalog');
    all.push(...data.result.list.filter(m=>safe(m.symbol)&&safe(m.baseCoin)&&safe(m.quoteCoin)&&m.status==='Trading'));
    const next=data.result?.nextPageCursor||'';if(!next||next===cursor)break;cursor=next;
   }
   if(signal.aborted||disposed)return;
   instruments=[...new Map(all.map(m=>[m.symbol,m])).values()].sort((a,b)=>a.symbol.localeCompare(b.symbol));
   if(!instruments.length)throw Error('No active Spot instruments returned');
   loaded=true;draw();void updatePrices();
  }catch(err){if(!signal.aborted&&!disposed)state.textContent='Unable to load Spot list: '+(err instanceof Error?err.message:'Network error')}
  finally{loading=false}
 };
 let refreshing=false;
 const updatePrices=async()=>{
  if(disposed||panel.hidden||!loaded||refreshing)return;
  refreshing=true;
  try{
   const res=await fetch('https://api.bybit.com/v5/market/tickers?category=spot',{credentials:'omit',cache:'no-store'});
   if(!res.ok)throw Error('HTTP '+res.status);
   const data=await res.json() as Tickers;
   if(data.retCode!==0||!Array.isArray(data.result?.list))throw Error('Invalid ticker list');
   if(disposed)return;
   prices=new Map(data.result.list.filter(x=>safe(x.symbol)).map(x=>[x.symbol,x]));draw();
  }catch{ /* Keep catalog usable if ticker feed is temporarily unavailable. */ }
  finally{refreshing=false}
 };
 const position=()=>{const rect=clickable?.getBoundingClientRect();if(!rect)return;panel.style.left=Math.max(4,Math.min(rect.left,innerWidth-Math.min(530,innerWidth-8)-4))+'px';panel.style.top=Math.min(innerHeight-100,rect.bottom+6)+'px'};
 const open=(query='')=>{input.value=query;limit=100;position();panel.hidden=false;draw();void load();input.focus({preventScroll:true})};
 const toggle=(e:Event)=>{e.preventDefault();e.stopPropagation();if(panel.hidden)open();else panel.hidden=true};
 const outside=(e:MouseEvent)=>{if(!panel.contains(e.target as Node)&&!clickable?.contains(e.target as Node))panel.hidden=true};
 const search=(e:Event)=>{const q=(e as CustomEvent<{query?:string}>).detail?.query??'';open(q)};
 input.addEventListener('input',()=>{limit=100;draw()});
 clickable?.addEventListener('click',toggle);document.addEventListener('click',outside);
 root.addEventListener('nexora:open-market-search',search);
 const esc=(e:KeyboardEvent)=>{if(e.key==='Escape')panel.hidden=true};
 document.addEventListener('keydown',esc);
 const timer=window.setInterval(()=>{void updatePrices()},10000);
 return ()=>{disposed=true;controller?.abort();clearInterval(timer);placeholder.remove();panel.remove();clickable?.removeEventListener('click',toggle);document.removeEventListener('click',outside);document.removeEventListener('keydown',esc);root.removeEventListener('nexora:open-market-search',search)};
}
