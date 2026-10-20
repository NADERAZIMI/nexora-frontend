/** Read-only token Info overlay backed solely by public MEXC Spot endpoints. */
type ExchangeDetail={symbol?:string;baseAsset?:string;quoteAsset?:string;fullName?:string};
type Ticker24={symbol?:string;lastPrice?:string;priceChangePercent?:string;highPrice?:string;lowPrice?:string;volume?:string;quoteVolume?:string;openPrice?:string};
const safe=(v:unknown):string=>typeof v==='string'&&v.trim()?v:'—';
const number=(v:unknown)=>{const n=Number(v);return v!==null&&v!==undefined&&v!==''&&Number.isFinite(n)?n:null};
const formatted=(v:unknown,unit='')=>{const n=number(v);return n===null?'—':n.toLocaleString('en-US',{maximumFractionDigits:10})+unit};
async function get<T>(path:string,signal:AbortSignal):Promise<T>{
 const response=await fetch('/mexc-public/api/v3/'+path,{signal,credentials:'omit',headers:{Accept:'application/json'}});
 if(!response.ok)throw new Error('HTTP '+response.status);
 const result=await response.json() as T & {code?:unknown};
 if(result&&typeof result==='object'&&'code' in result&&result.code!==0&&result.code!==200)throw new Error('API unavailable');
 return result;
}
export function attachSpotTokenInfo(root:HTMLElement):()=>void{
 const chart=root.querySelector<HTMLElement>('[class*="__chartWrapper"]');
 if(!chart)return ()=>{};
 const tabs=Array.from(chart.querySelectorAll<HTMLElement>('[role="tab"]'));
 const info=tabs.find(t=>t.textContent?.trim()==='Info');
 const chartTab=tabs.find(t=>t.textContent?.trim()==='Chart');
 if(!info||!chartTab)return ()=>{};
 const host=document.createElement('section');host.className='nexora-token-info';host.hidden=true;
 host.setAttribute('aria-label','NEXORA token information');
 chart.append(host);
 let selected='BTCUSDT',controller:AbortController|null=null,mounted=true,opened=false;
 const baseFrom=(symbol:string,quote:string)=>symbol.endsWith(quote)?symbol.slice(0,-quote.length):symbol;
 const render=(base:string,quote:string,infoData:ExchangeDetail|null,ticker:Ticker24|null,error='')=>{
   host.replaceChildren();
   const top=document.createElement('div');top.className='nexora-token-info-heading';
   const title=document.createElement('h2');title.textContent=base;
   const note=document.createElement('span');note.textContent=error?'Public market information unavailable':'Public Spot market information';
   top.append(title,note);host.append(top);
   const layout=document.createElement('div');layout.className='nexora-token-info-grid';
   const overview=document.createElement('div');const heading=document.createElement('h3');heading.textContent='Overview';overview.append(heading);
   const pct=number(ticker?.priceChangePercent);
   const facts:[string,string][]=[
    ['Token',safe(infoData?.fullName)||base],
    ['Trading Pair',base+'/'+quote],
    ['Last Price',formatted(ticker?.lastPrice,' '+quote)],
    ['24h Change',pct===null?'—':(pct*100).toFixed(2)+'%'],
    ['24h High',formatted(ticker?.highPrice,' '+quote)],
    ['24h Low',formatted(ticker?.lowPrice,' '+quote)],
    ['24h Volume',formatted(ticker?.volume,' '+base)],
    ['24h Quote Volume',formatted(ticker?.quoteVolume,' '+quote)]
   ];
   for(const [label,value] of facts){const row=document.createElement('div');row.className='nexora-token-info-fact';const key=document.createElement('span');key.textContent=label;const val=document.createElement('strong');val.textContent=value;row.append(key,val);overview.append(row);}
   const about=document.createElement('div');const sub=document.createElement('h3');sub.textContent='Introduction';about.append(sub);
   const paragraph=document.createElement('p');paragraph.textContent='A verified project description, market capitalization, rank, supply and official social links are not provided by the connected public Spot market endpoints. They will appear only when a reliable metadata source is available.';about.append(paragraph);
   if(error){const warn=document.createElement('p');warn.className='nexora-token-info-error';warn.textContent=error;about.append(warn);}
   layout.append(overview,about);host.append(layout);
 };
 const load=async()=>{
   controller?.abort();controller=new AbortController();const signal=controller.signal;
   const id=selected;
   render(baseFrom(id,'USDT'),'USDT',null,null,'Loading public market information…');
   try{
     const details=await Promise.allSettled([get<{symbols?:ExchangeDetail[]}>('exchangeInfo?symbol='+encodeURIComponent(id),signal),get<Ticker24>('ticker/24hr?symbol='+encodeURIComponent(id),signal)]);
     if(!mounted||signal.aborted||selected!==id)return;
     const metadata=details[0].status==='fulfilled'?details[0].value.symbols?.find(x=>x.symbol===id)??null:null;
     const ticker=details[1].status==='fulfilled'?details[1].value:null;
     const quote=metadata?.quoteAsset??'USDT';const base=metadata?.baseAsset??baseFrom(id,quote);
     render(base,quote,metadata,ticker,metadata||ticker?'':'Market data is currently unavailable.');
   }catch(error){if(!signal.aborted&&mounted)render(baseFrom(id,'USDT'),'USDT',null,null,String(error));}
 };
 const show=()=>{opened=true;host.hidden=false;void load()};
 const hide=()=>{opened=false;host.hidden=true;controller?.abort()};
 const onClick=(event:MouseEvent)=>{
  const t=event.target;
  if(!(t instanceof Element))return;
  if(info.contains(t)){event.preventDefault();event.stopImmediatePropagation();info.setAttribute('aria-selected','true');chartTab.setAttribute('aria-selected','false');show();}
  else if(tabs.some(tab=>tab.contains(t))){hide();info.setAttribute('aria-selected','false');}
 };
 const onSelect=(event:Event)=>{const symbol=(event as CustomEvent<{symbol?:string}>).detail?.symbol;if(symbol&&/^[A-Z0-9]{3,30}$/.test(symbol)){selected=symbol;if(opened)void load()}};
 root.addEventListener('click',onClick,true);
 root.addEventListener('nexora:market-selected',onSelect);
 return ()=>{mounted=false;controller?.abort();host.remove();root.removeEventListener('click',onClick,true);root.removeEventListener('nexora:market-selected',onSelect)};
}
