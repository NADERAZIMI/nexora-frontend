import { getCoinProfile, type CoinProfile } from './coingecko-info';
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
 let selected='BTCUSDT',selectedQuote='USDT',controller:AbortController|null=null,mounted=true,opened=false;
 const baseFrom=(symbol:string,quote:string)=>symbol.endsWith(quote)?symbol.slice(0,-quote.length):symbol;
 const render=(base:string,quote:string,infoData:ExchangeDetail|null,ticker:Ticker24|null,error='',profile:CoinProfile|null=null)=>{
   host.replaceChildren();
   const top=document.createElement('div');top.className='nexora-token-info-heading';
   const title=document.createElement('h2');title.textContent=profile?.name||base;
   const note=document.createElement('span');note.textContent=profile?'Project data: CoinGecko':'NEXORA Spot Info';
   top.append(title,note);host.append(top);
   const layout=document.createElement('div');layout.className='nexora-token-info-grid';
   const overview=document.createElement('div');const heading=document.createElement('h3');heading.textContent='Overview';overview.append(heading);
   const pct=number(ticker?.priceChangePercent);
   const facts:[string,string][]=[
    ['Token',profile?.name||infoData?.fullName?.trim()||base],
    ['Rank',profile?.rank===null||!profile?'—':'No.'+profile.rank],
    ['Market Cap',formatted(profile?.marketCap,' USD')],
    ['Fully Diluted Market Cap',formatted(profile?.fdv,' USD')],
    ['Circulating Supply',formatted(profile?.circulating)],
    ['Max Supply',formatted(profile?.max)],
    ['Total Supply',formatted(profile?.total)],
    ['All-Time High',formatted(profile?.ath,' USD')],
    ['All-Time Low',formatted(profile?.atl,' USD')],
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
   if(profile?.description){const paragraph=document.createElement('p');paragraph.textContent=profile.description;about.append(paragraph);}
   if(profile){
    const links=document.createElement('div');links.className='nexora-info-links';
    for(const [name,href] of [['Website',profile.homepage],['Explorer',profile.explorer],['X',profile.twitter],['Telegram',profile.telegram],['Reddit',profile.reddit],['GitHub',profile.github]]){
     if(!href)continue;
     const a=document.createElement('a');a.textContent=name;a.href=href;a.target='_blank';a.rel='noopener noreferrer nofollow';links.append(a);
    }
    about.append(links);
    if(profile.image){const logo=document.createElement('img');logo.className='nexora-info-logo';logo.src=profile.image;logo.alt='';top.prepend(logo);}
    const credit=document.createElement('p');credit.className='nexora-info-credit';credit.textContent='Project metadata: CoinGecko · market data: public Spot feed';about.append(credit);
   }
   if(error&&error!=='Loading project information…'){const warn=document.createElement('p');warn.className='nexora-token-info-error';warn.textContent=error;about.append(warn);}
   if(!profile?.description){const unavailable=document.createElement('p');unavailable.textContent='Introduction unavailable for this asset';unavailable.className='nexora-info-credit';about.append(unavailable);}
   layout.append(overview,about);host.append(layout);
 };
 const load=async()=>{
   controller?.abort();controller=new AbortController();const signal=controller.signal;
   const id=selected,quoteAtStart=selectedQuote,baseAtStart=baseFrom(id,quoteAtStart);
   let metadata:ExchangeDetail|null=null,ticker:Ticker24|null=null,profile:CoinProfile|null=null;
   let coinStatus='Loading project information…';
   const draw=()=>{
     if(!mounted||signal.aborted||selected!==id)return;
     const quote=metadata?.quoteAsset??quoteAtStart;
     const base=metadata?.baseAsset??baseFrom(id,quote);
     render(base,quote,metadata,ticker,coinStatus,profile);
   };
   draw();
   // CoinGecko is independent: do not wait for slower Spot exchangeInfo/ticker requests.
   const coinTask=getCoinProfile(baseAtStart,signal).then(data=>{
     if(signal.aborted)return;
     profile=data;
     coinStatus=''; // A missing unverified mapping is not an API failure.
     draw();
   }).catch(error=>{
     if(signal.aborted)return;
     coinStatus='CoinGecko request failed: '+(error instanceof Error?error.message:String(error));
     draw();
   });
   const marketTask=Promise.allSettled([
     get<{symbols?:ExchangeDetail[]}>('exchangeInfo?symbol='+encodeURIComponent(id),signal),
     get<Ticker24>('ticker/24hr?symbol='+encodeURIComponent(id),signal)
   ]).then(results=>{
     if(signal.aborted)return;
     metadata=results[0].status==='fulfilled'?results[0].value.symbols?.find(x=>x.symbol===id)??null:null;
     ticker=results[1].status==='fulfilled'?results[1].value:null;
     draw();
   });
   await Promise.allSettled([coinTask,marketTask]);
 };
 const markTabs=(active:HTMLElement)=>{
   for(const tab of tabs){
     const isActive=tab===active;
     tab.setAttribute('aria-selected',String(isActive));
     tab.parentElement?.classList.toggle('ant-tabs-v2-tab-active',isActive);
   }
 };
 const show=()=>{
   opened=true;
   chart.dataset.nexoraInfoOpen='true';
   host.hidden=false;
   markTabs(info);
   void load();
 };
 const hide=()=>{
   opened=false;
   delete chart.dataset.nexoraInfoOpen;
   host.hidden=true;
   controller?.abort();
 };
 const onClick=(event:MouseEvent)=>{
  const t=event.target;
  if(!(t instanceof Element))return;
  if(info.contains(t)){event.preventDefault();event.stopImmediatePropagation();show();}
  else if(tabs.some(tab=>tab.contains(t))){hide();markTabs(tabs.find(tab=>tab.contains(t))??chartTab);}
 };
 const onSelect=(event:Event)=>{const detail=(event as CustomEvent<{symbol?:string;quote?:string}>).detail;const symbol=detail?.symbol;if(symbol&&/^[A-Z0-9]{3,30}$/.test(symbol)){selected=symbol;selectedQuote=detail?.quote&&/^[A-Z0-9]{2,12}$/.test(detail.quote)?detail.quote:'USDT';if(opened)void load()}};
 root.addEventListener('click',onClick,true);
 root.addEventListener('nexora:market-selected',onSelect);
 return ()=>{mounted=false;hide();host.remove();root.removeEventListener('click',onClick,true);root.removeEventListener('nexora:market-selected',onSelect)};
}
