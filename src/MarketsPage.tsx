import {useEffect,useMemo,useState} from 'react';
import {TokenIcon} from './TokenIcon';
import type {SpotPair} from './spot-markets';
import type {MarketTicker} from './spot-tickers';
import './MarketsPage.css';
type Group='Crypto'|'Favorites'|'TradFi';
type Sort='name'|'price'|'change'|'turnover';
type ChangePeriod='1H'|'12H'|'24H'|'48H'|'7D'|'30D'|'90D';
const periodHours:Record<ChangePeriod,number>={'1H':1,'12H':12,'24H':24,'48H':48,'7D':168,'30D':720,'90D':2160};
const featuredAssets=['All','BTC','ETH','SOL','XRP','DOGE','BNB','ADA','LINK','AVAX','TRX','DOT','LTC','BCH','SUI','TON','SHIB','PEPE','NEAR','UNI','ATOM','APT','ARB','OP','NEXORA'] as const;
const fiatCurrencies=new Set(['USD','EUR','TRY','BRL','GBP','AUD','CAD','CHF','JPY','KRW','ARS','RUB','UAH','PLN','AED','SAR','ZAR','MXN','IDR','INR','NGN','VND','THB','MYR','SGD','HKD','CNY','CNH','TWD','PHP','EGP','KES','GHS','COP','PEN','CLP','CZK','HUF','RON','SEK','NOK','DKK','ILS','PKR','BDT','KZT','UZS','GEL','AZN','RSD','BGN','BHD','QAR','KWD','OMR','MAD','TND','DZD','BOB','UYU','PYG','CRC','DOP','BWP','ISK','NZD']);
const isCryptoPair=(pair:SpotPair)=>!fiatCurrencies.has(pair.base)&&!fiatCurrencies.has(pair.quote);
const periods:ChangePeriod[]=['1H','12H','24H','48H','7D','30D','90D'];
const changeCache=new Map<string,{reference:number;at:number}>();
async function loadReference(symbol:string,period:ChangePeriod,signal:AbortSignal):Promise<number|null>{
 if(!/^[A-Z0-9]{3,30}$/.test(symbol))return null;
 const hours=periodHours[period],now=Date.now(),at=now-hours*3600000;
 const key=symbol+':'+period;
 const cached=changeCache.get(key);if(cached&&now-cached.at<120000)return cached.reference;
 // A candle opening at or immediately before the comparison timestamp provides
 // a verifiable exchange reference; never substitute the 24H ticker for another range.
 const interval=hours<=48?'60':'D';
 const query=new URLSearchParams({category:'spot',symbol,interval,limit:hours<=48?'56':'100',end:String(now)});
 const urls=[`https://api.bybit.com/v5/market/kline?${query}`];
 if(['BTCUSDT','ETHUSDT','SOLUSDT','XRPUSDT'].includes(symbol))urls.unshift('/kline-cache/'+symbol+'/'+interval+'.json');
 for(const url of urls){
  try{const response=await fetch(url,{signal});if(!response.ok)continue;
   const json=await response.json() as {retCode?:number;list?:string[][];result?:{list?:string[][]};generatedAt?:number};
   if(!url.startsWith('/')&&json.retCode!==0)continue;
   if(url.startsWith('/')&&(!json.generatedAt||now-json.generatedAt>36*3600000))continue;
   const list=url.startsWith('/')?json.list:json.result?.list;
   if(!Array.isArray(list))continue;
   const rows=list.map(row=>({t:Number(row[0]),open:Number(row[1])})).filter(r=>Number.isFinite(r.t)&&r.open>0).sort((a,b)=>a.t-b.t);
   // For day-based timeframes, only show a value when an authentic reference candle exists.
   const chosen=[...rows].reverse().find(row=>row.t<=at);
   if(!chosen)continue;
   changeCache.set(key,{reference:chosen.open,at:now});return chosen.open;
  }catch(e){if(signal.aborted)return null}
 }
 return null;
}

const compact=(v:number)=>v>=1e9?(v/1e9).toFixed(2)+'B':v>=1e6?(v/1e6).toFixed(2)+'M':v>=1e3?(v/1e3).toFixed(2)+'K':v.toFixed(2);
const price=(v:number)=>Number.isFinite(v)?v.toLocaleString('en-US',{maximumFractionDigits:v>=1?4:10}):'—';
const percent=(v:number)=>(v>=0?'+':'')+(v*100).toFixed(2)+'%';
const NEXORA_PER_BTC=85264.135976; // indicative conversion ratio, not an exchange listing
export default function MarketsPage({pairs,tickers,ready,onTrade}:{pairs:SpotPair[];tickers:Record<string,MarketTicker>;ready:boolean;onTrade:(pair:SpotPair)=>void}){
 const [sortPeriod,setSortPeriod]=useState<ChangePeriod>('24H'),[references,setReferences]=useState<Record<string,number|null>>({}),[overviewTab,setOverviewTab]=useState('Overview'),[sectorFilter,setSectorFilter]=useState('All'),[group,setGroup]=useState<Group>('Crypto'),[query,setQuery]=useState(''),[quote,setQuote]=useState('All'),[sort,setSort]=useState<Sort>('turnover'),[ascending,setAscending]=useState(false),[page,setPage]=useState(1),[favorites,setFavorites]=useState<string[]>(()=>{try{return JSON.parse(localStorage.getItem('nexora-market-favorites')||'[]') as string[]}catch{return []}});
 const cryptoPairs=useMemo(()=>pairs.filter(isCryptoPair),[pairs]);
 const changeFor=(symbol:string,period:ChangePeriod):number|null=>{const ticker=tickers[symbol];if(!ticker)return null;if(period==='24H')return ticker.change;const reference=references[symbol+':'+period];return reference&&reference>0?(ticker.lastPrice/reference-1):null};
 const sorted=useMemo(()=>cryptoPairs.filter(p=>(group!=='Favorites'||favorites.includes(p.symbol))&&(quote==='All'||p.base===quote)&&(!query||p.symbol.toLowerCase().includes(query.toLowerCase())||p.base.toLowerCase().includes(query.toLowerCase()))).sort((a,b)=>{let n=0;const x=tickers[a.symbol],y=tickers[b.symbol];if(sort==='name')n=a.symbol.localeCompare(b.symbol);else if(sort==='change'){const cv=(symbol:string,ticker:MarketTicker|undefined)=>{if(!ticker)return undefined;if(sortPeriod==='24H')return ticker.change;const ref=references[symbol+':'+sortPeriod];return ref&&ref>0?ticker.lastPrice/ref-1:undefined};n=(cv(a.symbol,x)??-Infinity)-(cv(b.symbol,y)??-Infinity)}else n=(x?.[sort==='price'?'lastPrice':'turnover']??-Infinity)-(y?.[sort==='price'?'lastPrice':'turnover']??-Infinity);return ascending?n:-n;}),[cryptoPairs,tickers,group,quote,query,sort,ascending,favorites,sortPeriod,references]);
 const visible=sorted.slice((page-1)*30,page*30);
 const visibleKey=visible.map(p=>p.symbol).join(',');
 useEffect(()=>{const controller=new AbortController();let disposed=false;const symbols=visibleKey.split(',').filter(Boolean);const tasks=symbols.flatMap(symbol=>periods.filter(period=>period!=='24H').map(period=>({symbol,period})));let cursor=0;const worker=async()=>{while(cursor<tasks.length&&!controller.signal.aborted){const {symbol,period}=tasks[cursor++];const ref=await loadReference(symbol,period,controller.signal);if(!disposed)setReferences(prev=>prev[symbol+':'+period]===ref?prev:{...prev,[symbol+':'+period]:ref});}};void Promise.all(Array.from({length:4},worker));return()=>{disposed=true;controller.abort()};},[visibleKey]);
 const changeSort=(s:Sort)=>{if(s===sort)setAscending(!ascending);else{setSort(s);setAscending(s==='name')}setPage(1)};
 const toggleFavorite=(symbol:string)=>{const next=favorites.includes(symbol)?favorites.filter(x=>x!==symbol):[...favorites,symbol];setFavorites(next);try{localStorage.setItem('nexora-market-favorites',JSON.stringify(next))}catch{/* storage optional */}};
 const top=(mode:'gainers'|'new'|'trending')=>[...cryptoPairs].filter(x=>tickers[x.symbol]&&x.quote==='USDT'&&(mode!=='gainers'||changeFor(x.symbol,'24H')!==null)).sort((a,b)=>{const x=tickers[a.symbol],y=tickers[b.symbol];return mode==='gainers'?(changeFor(b.symbol,'24H')??-Infinity)-(changeFor(a.symbol,'24H')??-Infinity):mode==='trending'?y.turnover-x.turnover:0}).slice(0,3);
 const summaries=[['Top Gainers','gainers'],['Newly Listed','new'],['Trending','trending']] as const;
 const totalTurnover=Object.values(tickers).filter(t=>Number.isFinite(t.turnover)&&t.turnover>0).reduce((a,t)=>a+t.turnover,0);
 const marketsReady=Object.keys(tickers).length>0;
 const nexoraVisible=group==='Crypto'&&quote==='NEXORA';
 const btcSpot=tickers.BTCUSDT;
 // Every quote is a real active USDT-priced asset, not a fictitious listed NEXORA pair.
 // 1 BTC = 85,264.135976 NEXORA; value of 1 NEXORA in asset X = BTCUSDT / ratio / XUSDT.
 const assetQuotes=[...new Set(['USDT',...cryptoPairs.filter(p=>p.quote==='USDT'&&tickers[p.symbol]?.lastPrice>0).map(p=>p.base)])]
  .filter(asset=>!query||('NEXORA/'+asset).toLowerCase().includes(query.toLowerCase()))
  .sort((a,b)=>{const priority=['USDT','BTC','ETH','SOL','XRP','DOGE','PEPE','BNB','ADA','LINK','AVAX','TRX','SUI'];const ia=priority.indexOf(a),ib=priority.indexOf(b);return (ia<0?999:ia)-(ib<0?999:ib)||a.localeCompare(b)});
 const indicativePage=assetQuotes.slice((page-1)*30,page*30);
 const nexoraUsdt=btcSpot?.lastPrice&&btcSpot.lastPrice>0?btcSpot.lastPrice/NEXORA_PER_BTC:null;
 const indicativeFormat=(v:number)=>v.toLocaleString('en-US',{maximumFractionDigits:v<0.0001?12:v<1?10:6});
 const displayCount=nexoraVisible?assetQuotes.length:sorted.length;

 return <main className="markets-page">
 <div className="markets-overview-tabs">{['Overview','Key Metrics','Contract Data'].map(tab=><button key={tab} type="button" className={overviewTab===tab?'active':''} onClick={()=>setOverviewTab(tab)}>{tab}</button>)}</div>
 <section className="markets-overview">
 <div className="markets-overview-cards">
 <article className="markets-overview-stat"><div className="markets-card-heading"><b>Market Sentiment</b><button type="button" disabled title="Awaiting verified market sentiment data">View More →</button></div><div className="markets-sentiment-gauge"><div className="markets-gauge-arc"/><strong>—</strong><span>Not available</span></div><div className="markets-long-short"><i/><i/></div><div className="markets-sentiment-ends"><span>Long</span><span>Short</span></div><small>Awaiting a verified long/short sentiment source</small></article>
 <article className="markets-overview-stat"><div className="markets-card-heading"><b>Market Data</b><button type="button" onClick={()=>document.getElementById('markets-table')?.scrollIntoView({behavior:'smooth'})}>View More →</button></div><div className="markets-card-rule"/><div className="markets-market-data"><div><small>24H Spot Turnover (tracked quotes)</small><strong>{marketsReady?compact(totalTurnover)+' USDT*':'—'}</strong><small>{marketsReady?'Live Bybit ticker snapshot':'Waiting for WebSocket data'}</small></div><div className="markets-market-indicator">24H</div></div><small className="markets-card-note">*Aggregated ticker turnover; quote currencies may differ.</small></article>
 <article className="markets-overview-stat"><div className="markets-card-heading"><b>Trending Sectors</b></div><div className="markets-sector-placeholder"><strong>Sector rankings not connected</strong><span>Verified sector and constituent performance requires a separate market taxonomy feed.</span></div></article>
 </div></section>
  <section className="markets-section"><div className="markets-section-title"><h2>Markets</h2><input type="search" value={query} onChange={e=>{setQuery(e.target.value);setPage(1)}} placeholder="⌕  Search" aria-label="Search trading pairs"/></div><div className="markets-nav">{(['Favorites','Crypto','TradFi'] as Group[]).map(g=><button key={g} className={group===g?'active':''} onClick={()=>{setGroup(g);setPage(1)}}>{g}</button>)}</div><div className="markets-instruments"><button className="selected">Spot</button>{['Perpetual','Expiry','Options'].map(s=><button key={s} disabled title="Coming with NEXORA derivatives market data">{s}</button>)}</div>
 {group==='TradFi'?<div className="markets-empty">TradFi instruments are not part of the Bybit Spot catalog.</div>:<>
 <div className="markets-highlights">{summaries.map(([title,mode])=><div className="markets-highlight" key={mode}><h3>{title}</h3><div className="markets-highlight-head"><span>Pairs</span><span>Price</span><span>24H Change</span></div>{mode==='new'?<p className="markets-no-quote">Listing dates are not available in the current Spot catalog.</p>:top(mode).map(p=><button key={p.symbol} className="markets-highlight-row" onClick={()=>onTrade(p)}><span><TokenIcon symbol={p.base}/>{p.base}/{p.quote}</span><span>{price(tickers[p.symbol].lastPrice)}</span><span className={(changeFor(p.symbol,'24H')??0)>=0?'positive':'negative'}>{changeFor(p.symbol,'24H')===null?'—':percent(changeFor(p.symbol,'24H')!)}</span></button>)}{!ready&&<p className="markets-no-quote">Waiting for live prices…</p>}</div>)}</div>
 <div className="markets-filterbar"><div className="markets-quote-tabs">{featuredAssets.map(q=><button key={q} className={quote===q?'active':''} onClick={()=>{setQuote(q);setPage(1)}}>{q}{q==='NEXORA'&&<span aria-hidden="true" style={{marginLeft:5}}>🔥</span>}</button>)}</div></div><div className="markets-sector-filters">{['All','0 Fees','Margin Trading','Adventure Zone','RWA','SOL Eco','AI','DeFi','Meme','Stablecoin'].map(c=><button key={c} type="button" className={sectorFilter===c?'active':''} disabled={c!=='All'} title={c!=='All'?'Category metadata not connected yet':undefined} onClick={()=>setSectorFilter(c)}>{c}</button>)}</div><div className="markets-catalog-note"><strong>All Trading Pairs in All Crypto Spot</strong><span>Browse live prices, selected-period changes and 24H turnover for {cryptoPairs.length} available pairs.{nexoraVisible?' NEXORA: calculated reference rates (not exchange-listed) based on live BTC/USDT and a fixed 1 BTC = 85,264.135976 NEXORA ratio.':''}</span></div>
 <div id="markets-table" className="markets-table-scroll"><table className="markets-table"><thead><tr><th><button onClick={()=>changeSort('name')}>Trading Pairs ↕</button></th><th><button onClick={()=>changeSort('price')}>Last Price ↕</button></th>{periods.map(period=><th key={period} className="markets-period-column"><button onClick={()=>{if(sort==='change'&&sortPeriod===period)setAscending(!ascending);else{setSort('change');setSortPeriod(period);setAscending(false)}setPage(1)}}>{period} Change ↕</button></th>)}<th><button onClick={()=>changeSort('turnover')}>24H Turnover ↕</button></th><th>Action</th></tr></thead><tbody>{nexoraVisible&&indicativePage.map(asset=>{const ticker=asset==='USDT'?null:tickers[asset+'USDT'];const rate=nexoraUsdt!==null?(asset==='USDT'?nexoraUsdt:ticker?.lastPrice&&ticker.lastPrice>0?nexoraUsdt/ticker.lastPrice:null):null;const p24=btcSpot?.change!==undefined?(asset==='USDT'?btcSpot.change:ticker?.change!==undefined&&ticker.change>-1?(1+btcSpot.change)/(1+ticker.change)-1:null):null;return <tr key={'NEXORA/'+asset} className="markets-nexora-reference"><td><div className="markets-pair-cell"><TokenIcon symbol={asset}/><strong>NEXORA/{asset}</strong></div></td><td>{rate===null?'—':indicativeFormat(rate)}</td>{periods.map(period=><td key={period} className={period==='24H'&&p24!==null?(p24>=0?'positive':'negative'):''}>{period==='24H'&&p24!==null?percent(p24):'—'}</td>)}<td>—</td><td><span className="markets-reference-label">—</span></td></tr>})}{!nexoraVisible&&visible.map(p=>{const t=tickers[p.symbol];return <tr key={p.symbol}><td><div className="markets-pair-cell"><button className={'markets-favorite '+(favorites.includes(p.symbol)?'saved':'')} onClick={()=>toggleFavorite(p.symbol)} title="Toggle favorite">{favorites.includes(p.symbol)?'★':'☆'}</button><TokenIcon symbol={p.base}/><strong>{p.base}/{p.quote}</strong></div></td><td>{t?price(t.lastPrice):'—'}</td>{periods.map(period=>{const value=changeFor(p.symbol,period);return <td key={period} className={value===null?'':value>=0?'positive':'negative'}>{value===null?'—':percent(value)}</td>})}<td>{t?compact(t.turnover)+' '+p.quote:'—'}</td><td><button className="markets-trade-button" onClick={()=>onTrade(p)}>Trade <span>↗</span></button></td></tr>})}</tbody></table>{displayCount===0&&<p className="markets-empty">No matching Spot pairs for this asset. NEXORA trading will appear when an actual listed pair is available.</p>}</div>
 <div className="markets-pagination"><span>{nexoraVisible?assetQuotes.length+' indicative NEXORA rates':sorted.length+' trading pairs'}</span><div><button disabled={page<=1} onClick={()=>setPage(v=>v-1)}>Previous</button><span>Page {page} / {Math.max(1,Math.ceil(displayCount/30))}</span><button disabled={page*30>=displayCount} onClick={()=>setPage(v=>v+1)}>Next</button></div></div>
 </>}</section></main>;
}
