import React, { useState } from 'react';
import {useSpotMarkets,useFilteredPairs,type SpotPair} from './spot-markets';
import {useSpotTickers,type MarketTicker} from './spot-tickers';
import {TokenIcon} from './TokenIcon';
import {useTokenOverview} from './useTokenOverview';
import DataPanel from './DataPanel';
import MarketsPage from './MarketsPage';
import SpotProChart from './SpotProChart';
import CustomizationDashboard,{loadDesign,applyDesign} from './CustomizationDashboard';
import FeedPanel from './FeedPanel';
import { createRoot } from 'react-dom/client';
import './styles.css';
import './theme.css';
import {useBybitSpotBook,type BookState} from './useBybitSpotBook';
const LOGO='/nexora-n.svg';
type BookSide='buy'|'sell';
function Brand(){return <div className="brand"><img src={LOGO} alt="NEXORA symbol" /><strong>NE<span className="brand-x">X</span>ORA</strong></div>}
type Page='trade'|'markets'|'dashboard';type Theme='dark'|'light';
function Header({page,setPage,theme,toggleTheme}:{page:Page;setPage:(page:Page)=>void;theme:Theme;toggleTheme:()=>void}){
 const entries=[['Buy Crypto',null],['Markets','markets'],['Trade','trade'],['TradFi',null],['Tools',null],['Finance',null],['Card',null],['Discover',null],['More',null]] as const;
 return <header className="topbar"><div className="nx-brand-click" role="button" tabIndex={0} onClick={()=>setPage('trade')} onKeyDown={e=>{if(e.key==='Enter')setPage('trade')}}><Brand/></div><nav className="toplinks" aria-label="Main navigation">{entries.map(([label,target])=><button key={label} className={target===page?'selected':''} type="button" onClick={()=>{if(target)setPage(target)}} disabled={!target} title={!target?'Coming soon':undefined}>{label}{['Trade','Tools','Finance','Discover','More'].includes(label)&&<span className="nx-menu-chevron">⌄</span>}</button>)}</nav><button type="button" className={page==='dashboard'?'nx-dashboard-entry selected':'nx-dashboard-entry'} onClick={()=>setPage('dashboard')} aria-label="Open customization dashboard">Dashboard <span>+</span></button><div className="topright"><button type="button" className="nx-theme-switch" onClick={toggleTheme} title={theme==='dark'?'Switch to Light Mode':'Switch to Dark Mode'} aria-label={theme==='dark'?'Enable light mode':'Enable dark mode'} aria-pressed={theme==='light'}>{theme==='dark'?'☀':'☾'}</button><button className="outline">Log In</button><button className="primary">Sign Up</button></div></header>
}
const display='—';
const formatLivePrice=(value:number)=>value.toLocaleString('en-US',{maximumFractionDigits:12});
function MarketBar({pair,onSelect,pairs,source,tickers,pricesReady,book,livePrice}:{pair:SpotPair;onSelect:(pair:SpotPair)=>void;pairs:SpotPair[];source:'loading'|'live'|'fallback';tickers:Record<string,MarketTicker>;pricesReady:boolean;book:BookState;livePrice:number|null}){
 const [open,setOpen]=useState(false),[search,setSearch]=useState('');
 const [category,setCategory]=useState<'Favorites'|'Crypto'|'TradFi'>('Crypto');
 const [quote,setQuote]=useState('All');
 const [sort,setSort]=useState<'default'|'price'|'change'|'volume'>('default');
 const [favorites,setFavorites]=useState<string[]>([]);
 const matched=useFilteredPairs(pairs,search);
 const found=matched.filter(p=>(category!=='Favorites'||favorites.includes(p.symbol))&&(quote==='All'||p.quote===quote));
 const ordered=[...found].sort((x,y)=>{
   if(sort==='default')return Number(y.symbol===pair.symbol)-Number(x.symbol===pair.symbol);
   const a=tickers[x.symbol],b=tickers[y.symbol];
   const va=sort==='price'?a?.lastPrice:sort==='change'?a?.change:a?.turnover;
   const vb=sort==='price'?b?.lastPrice:sort==='change'?b?.change:b?.turnover;
   return (vb??-Infinity)-(va??-Infinity);
 });
 const formatPrice=(v:number)=>v.toLocaleString('en-US',{maximumFractionDigits:v>=1?4:8});
 const formatVolume=(v:number)=>v>=1e9?(v/1e9).toFixed(2)+'B':v>=1e6?(v/1e6).toFixed(2)+'M':v>=1000?(v/1000).toFixed(2)+'K':v.toFixed(2);
 const selectedTicker=book.ticker;
 const trade=book.trades[0];
 const lastClass=trade?(trade.side==='Buy'?'market-up':'market-down'):'market-flat';
 const marketPrice=(v:number|undefined)=>v===undefined||!Number.isFinite(v)?'—':formatPrice(v);
 const signedChange=selectedTicker?(selectedTicker.change>=0?'+':'')+(selectedTicker.change*100).toFixed(2)+'%':'—';
 const changeClass=selectedTicker?(selectedTicker.change>0?'market-up':selectedTicker.change<0?'market-down':'market-flat'):'market-flat';
 return <section className="marketbar"><div className="pair-selector">
 <div className="pair pair-label"><span className="coin">{pair.base.slice(0,1)}</span><span><strong>{pair.base}/{pair.quote}</strong><small>Spot Trading</small></span><button className="pair-open-button" type="button" aria-label="Open spot pair list" aria-haspopup="dialog" aria-expanded={open} onClick={()=>setOpen(value=>!value)} title="Choose trading pair"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m3.5 6 4.5 4 4.5-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg></button></div>
 {open&&<div className="market-dropdown" role="dialog" aria-label="Spot market selector">
 <div className="market-search-line"><input autoFocus value={search} onChange={e=>setSearch(e.target.value)} placeholder="⌕  Search markets" aria-label="Search spot markets"/><button type="button" title="Close" aria-label="Close" onClick={()=>setOpen(false)}>✕</button></div>
 <div className="market-main-tabs">{(['Favorites','Crypto','TradFi'] as const).map(x=><button type="button" className={category===x?'active':''} key={x} onClick={()=>setCategory(x)}>{x}</button>)}</div>
 <div className="market-type-tabs"><button className="active">Spot</button><button disabled>Perpetual</button><button disabled>Expiry</button><button disabled>Options</button><button disabled>Pre-Market</button></div>
 <div className="market-filter-tabs"><button className="market-quote" onClick={()=>setQuote(quote==='USDT'?'All':'USDT')}>{quote}⌄</button><button className={quote==='All'?'active':''} onClick={()=>setQuote('All')}>All</button><button disabled>New</button><button disabled>0 Fees</button><button disabled>Margin Trading</button></div>
 <div className="market-table-head"><button onClick={()=>setSort('default')}>Name ↕</button><button onClick={()=>setSort('price')}>Price ↕</button><button onClick={()=>setSort('change')}>24H % ↕</button><button onClick={()=>setSort('volume')}>Volume ↕</button></div>
 <div className="market-catalog-status">{source==='live'?'Bybit Spot pairs':source==='loading'?'Loading market catalog…':'Popular pairs (live catalog unavailable)'} · {pricesReady?'Live price data':'Price feed unavailable'} · {found.length}</div>
 <div className="market-items">{category==='TradFi'?<div className="market-noresults">TradFi markets are not part of Bybit Spot catalog</div>:ordered.map(p=>{
 const tick=tickers[p.symbol],active=p.symbol===pair.symbol,star=favorites.includes(p.symbol);
 return <div className={'market-table-row '+(active?'active':'')} key={p.symbol}>
 <button className={'market-star '+(star?'saved':'')} title={star?'Remove favorite':'Add favorite'} aria-label={'Favorite '+p.symbol} onClick={()=>setFavorites(prev=>star?prev.filter(x=>x!==p.symbol):[...prev,p.symbol])}>{star?'★':'☆'}</button>
 <button className="market-row-select" onClick={()=>{onSelect(p);setOpen(false);setSearch('');}}>
 <span className="market-symbol-cell"><TokenIcon symbol={p.base}/><span className="market-coin-name"><strong>{p.base}</strong><small>{p.quote}</small></span></span>
 <span className="market-numeric">{tick?formatPrice(tick.lastPrice):'—'}</span>
 <span className={'market-numeric '+(tick?(tick.change>=0?'positive':'negative'):'')}>{tick?(tick.change>=0?'+':'')+(tick.change*100).toFixed(2)+'%':'—'}</span>
 <span className="market-numeric">{tick?formatVolume(tick.turnover)+' ('+p.quote+')':'—'}</span>
 </button></div>;})}{found.length===0&&category!=='TradFi'&&<div className="market-noresults">No matching Spot pairs</div>}</div>
 </div>}
 </div><div className={'price market-last '+lastClass}><strong>{livePrice!==null?formatLivePrice(livePrice):'—'}</strong><small>{livePrice!==null?'≈'+formatLivePrice(livePrice)+' '+pair.quote:'Waiting for live trades…'}</small></div>
 <div className="marketstat market-change"><small>24H Change</small><strong className={changeClass}>{signedChange}</strong></div>
 <div className="marketstat"><small>24H High</small><strong>{marketPrice(selectedTicker?.high)}</strong></div>
 <div className="marketstat"><small>24H Low</small><strong>{marketPrice(selectedTicker?.low)}</strong></div>
 <div className="marketstat"><small>24H Volume ({pair.base})</small><strong>{selectedTicker?.volume!==undefined?formatVolume(selectedTicker.volume):'—'}</strong></div>
 <div className="marketstat"><small>24H Turnover ({pair.quote})</small><strong>{selectedTicker?formatVolume(selectedTicker.turnover):'—'}</strong></div>
 <span className="marketstate"><i/>{pricesReady?'Live Bybit tickers':'Market data unavailable'}</span></section>
}
function TokenInfoPanel({pair}:{pair:SpotPair}){
 const {info,status}=useTokenOverview(pair.base);
 const fmt=(n:number|undefined,dec=2)=>n===undefined?'—':n.toLocaleString('en-US',{maximumFractionDigits:dec});
 const usd=(n:number|undefined)=>n===undefined?'—':'$'+fmt(n,n<1?8:2);
 const pct=(n:number|undefined)=>n===undefined?'—':n.toFixed(2)+'%';
 const date=(v:string|undefined)=>v?new Date(v).toLocaleDateString('en-CA'):'—';
 const circulation=info?.circulating!==undefined&&info.total?100*info.circulating/info.total:undefined;
 const volRatio=info?.volume24h!==undefined&&info.marketCap?100*info.volume24h/info.marketCap:undefined;
 const links=[{text:'White Paper',url:info?.whitepaper},{text:'Official Website',url:info?.homepage},{text:'Block Explorer',url:info?.explorers?.[0]},{text:'Github',url:info?.socials?.github}];
 return <div className="token-info-screen">
  <div className="token-info-header"><TokenIcon symbol={pair.base}/><strong>{pair.base}</strong></div>
  <div className="token-info-columns">
   <div className="token-info-facts"><h3>Overview</h3>
   {([['Rank',info?.rank!==undefined?'No.'+fmt(info.rank,0):'—'],
    ['Market Cap',usd(info?.marketCap)],['Fully Diluted Market Cap',usd(info?.fdv)],
    ['Market Share',pct(info?.marketShare)],['Trading Vol/Market Cap (24H)',pct(volRatio)],
    ['Circulating Supply',fmt(info?.circulating,0)],['Max Supply',fmt(info?.max,0)],
    ['Total Supply',fmt(info?.total,0)],['Circulation Rate',pct(circulation)],
    ['Issue Date',info?.genesisDate||'—'],['Issue Price','—'],
    ['All-Time High',usd(info?.ath)],['ATH Date',date(info?.athDate)],
    ['Lowest Price',usd(info?.atl)],['ATL Date',date(info?.atlDate)],
    ['Public Blockchain',pair.base]] as [string,string][]).map(([name,value])=><div className="token-info-fact" key={name}><span>{name}</span><strong>{value}</strong></div>)}
   </div>
   <div className="token-info-intro"><h3>Introduction</h3>
    <p>{info?.description|| (status==='loading'?'Loading token information…':'Verified introduction is currently unavailable.')}</p>
    <h3>Sector</h3><div className="token-info-tags">{info?.categories?.length?info.categories.map(x=><span key={x}>{x}</span>):<span className="token-info-missing">—</span>}</div>
    <h3>Social Media</h3><div className="token-info-links">{info?.socials?.reddit&&<a href={info.socials.reddit} target="_blank" rel="noopener noreferrer">Reddit</a>}{info?.socials?.twitter&&<a href={info.socials.twitter} target="_blank" rel="noopener noreferrer">X</a>}</div>
    <h3>Related Links</h3><div className="token-info-links">{links.filter((x):x is {text:string;url:string}=>Boolean(x.url?.startsWith('https://'))).map(x=><a key={x.text} href={x.url} target="_blank" rel="noopener noreferrer">{x.text}</a>)}</div>
    <p className="token-info-source">Token metadata: CoinGecko. Market figures can differ from Bybit. Information is not investment advice.</p>
   </div>
  </div>
 </div>;
}
const tabs=['Chart','Info','Data','Feed','Trade Analysis'] as const;
function ChartPanel({pair,livePrice}:{pair:SpotPair;livePrice:number|null}){const [tab,setTab]=useState<(typeof tabs)[number]>('Chart');return <section className="panel chart"><div className="tabs">{tabs.map(x=><button key={x} onClick={()=>setTab(x)} className={tab===x?'active':''}>{x}</button>)}<span className="paneltools">⚙　⛶</span></div>{tab==='Feed'?<FeedPanel symbol={pair.symbol}/>:tab==='Data'?<DataPanel symbol={pair.symbol}/>:tab==='Info'?<TokenInfoPanel pair={pair}/>:tab==='Chart'?<><div className="chart-area"><SpotProChart pair={pair} frame="1h" livePrice={livePrice}/></div></>:<div className="waiting">{tab} panel · React component ready for live data</div>}</section>}
function OrderBook({pair,book,livePrice}:{pair:SpotPair;book:BookState;livePrice:number|null}){
 const [mode,setMode]=useState('Order Book');
 const [stepMultiplier,setStepMultiplier]=useState(1);
 const [layout,setLayout]=useState<'both'|'split'|'bids'|'asks'>('both');
 // Infer the finest displayed exchange tick from actual order-book price levels.
 const prices=[...book.asks,...book.bids].map(x=>x.price).filter(x=>Number.isFinite(x)&&x>0).sort((a,b)=>a-b);
 const gaps=prices.slice(1).map((p,i)=>p-prices[i]).filter(d=>d>1e-12);
 const refPrice=book.trades[0]?.price??book.bids[0]?.price??book.asks[0]?.price??1;
 const inferredTick=gaps.length?Math.min(...gaps):Math.pow(10,Math.floor(Math.log10(refPrice))-3);
 const tickBase=Math.pow(10,Math.floor(Math.log10(Math.max(1e-12,inferredTick))+1e-7));
 const step=tickBase*stepMultiplier;
 const precision=Math.min(12,Math.max(0,-Math.floor(Math.log10(step)+1e-7)));
 const rawPrecision=Math.min(12,Math.max(precision,-Math.floor(Math.log10(tickBase)+1e-7)));
 const priceText=(n:number,digits=precision)=>n.toLocaleString('en-US',{minimumFractionDigits:digits,maximumFractionDigits:digits});
 const qtyText=(n:number)=>n.toLocaleString('en-US',{maximumFractionDigits:8});
 const stepLabel=(n:number)=>n.toLocaleString('en-US',{useGrouping:false,maximumFractionDigits:12});
 const aggregate=(levels:typeof book.asks,ask:boolean)=>{
   const tick=step;
   const byPrice=new Map<number,number>();
   for(const level of levels){
     const units=ask?Math.ceil(level.price/tick-1e-7):Math.floor(level.price/tick+1e-7);
     const key=Number((units*tick).toFixed(precision));
     byPrice.set(key,(byPrice.get(key)||0)+level.amount);
   }
   let cumulative=0;
   return [...byPrice.entries()].sort((a,b)=>ask?a[0]-b[0]:b[0]-a[0]).slice(0,12).map(([price,amount])=>({price,amount,total:(cumulative+=amount)}));
 };
 const asks=aggregate(book.asks,true),bids=aggregate(book.bids,false);
 const maxTotal=Math.max(1,...asks.map(x=>x.total),...bids.map(x=>x.total));
 const drawRows=(rows:typeof asks,side:'ask'|'bid')=>rows.map(r=><div className={'book-row '+side} key={r.price}>
   <span className="book-bar" style={{width:(r.total/maxTotal*100)+'%'}}/>
   <span className="book-number book-price">{priceText(r.price)}</span>
   <span className="book-number">{qtyText(r.amount)}</span>
   <span className="book-number">{qtyText(r.total)}</span>
 </div>);
 const last=book.trades[0],mid=livePrice;
 const askQty=book.asks.reduce((n,x)=>n+x.amount,0),bidQty=book.bids.reduce((n,x)=>n+x.amount,0);
 const buyPercent=bidQty+askQty?Math.round(100*bidQty/(bidQty+askQty)):0;
 return <section className={'panel orderbook depth-layout-'+layout}>
 <div className="tabs compact"><button className={mode==='Order Book'?'active':''} onClick={()=>setMode('Order Book')}>Order Book</button><button className={mode==='Recent Trades'?'active':''} onClick={()=>setMode('Recent Trades')}>Recent Trades</button><span className={'stream-state '+(book.synchronized?'ready':'')}>{book.synchronized?'● Live':book.connected?'● Syncing':'○ Offline'}</span></div>
 {mode==='Order Book'?<>
  <div className="obtools"><div className="depth-modes" role="group" aria-label="Order book display layout">{(['both','split','bids','asks'] as const).map((value)=><button type="button" key={value} className={'depth-layout-button '+(layout===value?'selected':'')} aria-label={{both:'Sell above buy',split:'Side by side depth',bids:'Buy orders only',asks:'Sell orders only'}[value]} title={{both:'Sells above buys',split:'Side-by-side',bids:'Buy only',asks:'Sell only'}[value]} aria-pressed={layout===value} onClick={()=>setLayout(value)}><svg className="depth-layout-svg" viewBox="0 0 22 20" width="22" height="20" aria-hidden="true">
{value==='both'?<><rect x="1" y="2" width="8" height="6" rx=".7" fill="#F05A70"/><rect x="1" y="10" width="8" height="6" rx=".7" fill="#16B89A"/></>:<rect x="1" y="2" width="8" height="14" rx=".7" fill={value==='bids'?'#16B89A':value==='asks'?'#F05A70':'#41464e'}/>}
{value==='split'?<><rect x="1" y="2" width="8" height="6" fill="#F05A70"/><rect x="1" y="10" width="8" height="6" fill="#16B89A"/></>:null}
<path d="M11 3H21 M11 6H21 M11 9H21 M11 12H21 M11 15H21" stroke="#5f6269" strokeWidth="1.4"/>
</svg></button>)}</div><select aria-label="Price precision" value={stepMultiplier} onChange={e=>setStepMultiplier(Number(e.target.value))}>{[1,10,100,1000].map(x=><option value={x} key={x}>{stepLabel(tickBase*x)}</option>)}</select></div>
  <div className="obhead book-columns"><span>Price ({pair.quote})</span><span>Qty ({pair.base})</span><span>Total ({pair.base})</span></div>
  {layout!=='bids'&&<div className={'depthblock '+(layout==='split'?'split-asks':'')}><div className="book-rows">{book.synchronized?drawRows([...asks].reverse(),'ask'):<div className="depth-placeholder">{book.error||'Waiting for Bybit snapshot…'}</div>}</div></div>}
  <div className={'midprice '+(last?.side==='Buy'?'up':'down')}><span>{mid!==null?formatLivePrice(mid):display}</span><small>{mid!==null?'≈ '+formatLivePrice(mid)+' '+pair.quote:'USDT'}</small></div>
  {layout!=='asks'&&<div className={'depthblock '+(layout==='split'?'split-bids':'')}><div className="book-rows">{book.synchronized?drawRows(bids,'bid'):<div className="depth-placeholder">{book.error||'Waiting for Bybit snapshot…'}</div>}</div></div>}
  <div className="book-ratio" aria-label="Displayed depth buy sell proportions"><div className="ratio-buy" style={{width:buyPercent+'%'}}>B&nbsp; {book.synchronized?buyPercent+'%':'—'}</div><div className="ratio-sell" style={{width:(100-buyPercent)+'%'}}>{book.synchronized?(100-buyPercent)+'%':'—'} &nbsp;S</div></div>
 </>:<div className="recent-trades"><div className="obhead book-columns"><span>Price ({pair.quote})</span><span>Qty ({pair.base})</span><span>Time</span></div>{book.trades.length?book.trades.slice(0,35).map(t=><div className={'book-row '+(t.side==='Buy'?'bid':'ask')} key={t.id}><span className="book-number book-price">{priceText(t.price)}</span><span className="book-number">{qtyText(t.amount)}</span><span className="book-number">{new Date(t.timestamp).toLocaleTimeString('en-GB')}</span></div>):<div className="waiting">Waiting for public trades…</div>}</div>}
 </section>;
}
function TradingForm({side,pair}:{side:BookSide;pair:SpotPair}){const [kind,setKind]=useState('Limit');const [price,setPrice]=useState('');const [amount,setAmount]=useState('');const [percent,setPercent]=useState(0);return <div className="tradeform"><div className="formcaption"><span>Available</span><span>— {side==='buy'?pair.quote:pair.base}</span></div><div className="ordertypes">{['Limit','Market','Stop Limit'].map(x=><button key={x} onClick={()=>setKind(x)} className={kind===x?'active':''}>{x}</button>)}</div>{kind!=='Market'&&<label className="field"><span>Price</span><input type="number" min="0" placeholder="Enter price" value={price} onChange={e=>setPrice(e.target.value)}/><strong>{pair.quote}</strong></label>}<label className="field"><span>Amount</span><input type="number" min="0" placeholder="Enter amount" value={amount} onChange={e=>setAmount(e.target.value)}/><strong>{pair.base}</strong></label><div className="order-percent-control"><div className="order-percent-track"><input className="percentage" type="range" min="0" max="100" step="1" value={percent} style={{background:`linear-gradient(to right,#3378FF 0%,#3378FF ${percent}%,#15191F ${percent}%,#15191F 100%)`}} onChange={e=>setPercent(Number(e.target.value))} aria-label="Order percentage"/>{[0,25,50,75,100].map(mark=><button key={mark} type="button" className={"order-percent-dot"+(percent>=mark?" selected":"")+(percent===mark?" at-thumb":"")} style={{left:`calc(7.5px + (100% - 15px) * ${mark/100})`}} aria-label={`Set order percentage to ${mark}%`} onClick={()=>setPercent(mark)}/>)}</div><div className="rangelabel">{[0,25,50,75,100].map(mark=><button type="button" key={mark} onClick={()=>setPercent(mark)} className={percent===mark?"selected":""}>{mark}%</button>)}</div></div><div className="formcaption"><span>Total</span><span>— {pair.quote}</span></div><button className={'tradeaction '+side} disabled>{side==='buy'?'Buy '+pair.base:'Sell '+pair.base}</button><p className="loginprompt">Trading requires account connection</p></div>}
function TradePanel({pair}:{pair:SpotPair}){const [side,setSide]=useState<BookSide>('buy');return <section className="panel tradepanel"><div className="tabs compact"><button className="active">Spot</button><button>Margin</button></div><div className="sidepicker"><button className={side==='buy'?'buy chosen':''} onClick={()=>setSide('buy')}>Buy</button><button className={side==='sell'?'sell chosen':''} onClick={()=>setSide('sell')}>Sell</button></div><TradingForm side={side} pair={pair}/></section>}
function Orders(){const [tab,setTab]=useState('Open Orders (0)');return <section className="panel orders"><div className="tabs compact">{['Open Orders (0)','Order History','Trade History','Assets'].map(x=><button key={x} className={tab===x?'active':''} onClick={()=>setTab(x)}>{x}</button>)}</div><div className="orders-empty">Sign in to view your {tab.toLowerCase()}</div></section>}
function ActiveMarket({pair,onSelect,pairs,source,tickers,pricesReady}:{pair:SpotPair;onSelect:(pair:SpotPair)=>void;pairs:SpotPair[];source:'loading'|'live'|'fallback';tickers:Record<string,MarketTicker>;pricesReady:boolean}){
 const book=useBybitSpotBook(pair.symbol);
 const livePrice=book.connected?(book.trades[0]?.price??book.ticker?.lastPrice??null):null;
 type Layout={book:number;trade:number;height:number};
 const defaultLayout:Layout={book:17,trade:16,height:600};
 const [layout,setLayout]=React.useState<Layout>(()=>{
  try{const stored=JSON.parse(localStorage.getItem('nexora:spot-panel-layout:v1')||'null') as Layout|null;
   if(stored&&Number.isFinite(stored.book)&&Number.isFinite(stored.trade)&&Number.isFinite(stored.height))
    return {book:Math.min(25,Math.max(13,stored.book)),trade:Math.min(25,Math.max(13,stored.trade)),height:Math.min(960,Math.max(440,stored.height))};
  }catch{}return defaultLayout;
 });
 const workspaceRef=React.useRef<HTMLDivElement>(null);
 const layoutRef=React.useRef(layout);
 const dragRef=React.useRef<{target:'book'|'trade'|'height';pointerId:number}|null>(null);
 const frameRef=React.useRef<number|null>(null);
 const applyLayout=React.useCallback((value:Layout)=>{
  const node=workspaceRef.current;if(!node)return;
  const chart=100-value.book-value.trade;
  node.style.setProperty('--nx-chart-col',chart+'fr');
  node.style.setProperty('--nx-book-col',value.book+'fr');
  node.style.setProperty('--nx-trade-col',value.trade+'fr');
  node.style.setProperty('--nx-chart-row',value.height+'px');
  const first=node.querySelector<HTMLElement>('.nx-resize-chart-book');
  const second=node.querySelector<HTMLElement>('.nx-resize-book-trade');
  const horizontal=node.querySelector<HTMLElement>('.nx-resize-orders');
  if(first)first.style.left=chart+'%';
  if(second)second.style.left=(100-value.trade)+'%';
  if(horizontal)horizontal.style.top=value.height+'px';
 },[]);
 React.useEffect(()=>{applyLayout(layoutRef.current)},[applyLayout]);
 React.useEffect(()=>{
  const node=workspaceRef.current;if(!node)return;
  const onMove=(event:PointerEvent)=>{
   const drag=dragRef.current;if(!drag||event.pointerId!==drag.pointerId)return;
   const bounds=node.getBoundingClientRect();
   const curr=layoutRef.current;
   let next=curr;
   if(drag.target==='height')next={...curr,height:Math.max(440,Math.min(960,Math.round(event.clientY-bounds.top)))};
   else{
    const percent=(event.clientX-bounds.left)/bounds.width*100;
    if(drag.target==='book'){
     const chart=Math.max(36,Math.min(100-curr.trade-13,percent));
     next={...curr,book:100-chart-curr.trade};
    }else{
     const bookEnd=Math.max(100-25,Math.min(100-13,percent));
     next={...curr,trade:100-bookEnd};
    }
   }
   layoutRef.current=next;
   if(frameRef.current===null)frameRef.current=requestAnimationFrame(()=>{frameRef.current=null;applyLayout(layoutRef.current)});
  };
  const finish=()=>{
   if(!dragRef.current)return;
   dragRef.current=null;
   node.classList.remove('nx-is-resizing');
   document.body.style.cursor='';
   document.body.style.userSelect='';
   if(frameRef.current!==null){cancelAnimationFrame(frameRef.current);frameRef.current=null}
   applyLayout(layoutRef.current);
   try{localStorage.setItem('nexora:spot-panel-layout:v1',JSON.stringify(layoutRef.current))}catch{}
  };
  window.addEventListener('pointermove',onMove,{passive:true});
  window.addEventListener('pointerup',finish);
  window.addEventListener('pointercancel',finish);
  window.addEventListener('blur',finish);
  return()=>{window.removeEventListener('pointermove',onMove);window.removeEventListener('pointerup',finish);window.removeEventListener('pointercancel',finish);window.removeEventListener('blur',finish);if(frameRef.current!==null)cancelAnimationFrame(frameRef.current)};
 },[applyLayout]);
 const startDrag=(event:React.PointerEvent<HTMLDivElement>,target:'book'|'trade'|'height')=>{
  if(event.button!==0)return;
  event.preventDefault();
  dragRef.current={target,pointerId:event.pointerId};
  workspaceRef.current?.classList.add('nx-is-resizing');
  document.body.style.cursor=target==='height'?'row-resize':'col-resize';
  document.body.style.userSelect='none';
 };
 const chartWidth=100-layout.book-layout.trade;
 return <main><MarketBar pair={pair} onSelect={onSelect} pairs={pairs} source={source} tickers={tickers} pricesReady={pricesReady} book={book} livePrice={livePrice}/><div ref={workspaceRef} className="workspace nx-resizable-workspace" style={{'--nx-chart-col':chartWidth+'fr','--nx-book-col':layout.book+'fr','--nx-trade-col':layout.trade+'fr','--nx-chart-row':layout.height+'px'} as React.CSSProperties}><ChartPanel pair={pair} livePrice={livePrice}/><OrderBook pair={pair} book={book} livePrice={livePrice}/><TradePanel pair={pair}/><Orders/>
 <div className="nx-resize-handle nx-resize-chart-book" role="separator" aria-label="Resize chart and order book" aria-orientation="vertical" title="Drag to resize chart and order book" style={{left:chartWidth+'%'}} onPointerDown={e=>startDrag(e,'book')}><span/></div>
 <div className="nx-resize-handle nx-resize-book-trade" role="separator" aria-label="Resize order book and trade panel" aria-orientation="vertical" title="Drag to resize order book and trade panel" style={{left:(100-layout.trade)+'%'}} onPointerDown={e=>startDrag(e,'trade')}><span/></div>
 <div className="nx-resize-handle nx-resize-orders" role="separator" aria-label="Resize chart and orders section" aria-orientation="horizontal" title="Drag to resize chart and orders" style={{top:layout.height+'px'}} onPointerDown={e=>startDrag(e,'height')}><span/></div>
 </div></main>;
}
function App(){const {pairs,source}=useSpotMarkets();const {tickers,ready:pricesReady}=useSpotTickers(pairs);const [pair,setPair]=useState<SpotPair>({symbol:'BTCUSDT',base:'BTC',quote:'USDT'});const [page,setPage]=useState<Page>(()=>window.location.pathname.startsWith('/dashboard')?'dashboard':window.location.pathname.startsWith('/markets')?'markets':'trade');const [theme,setTheme]=useState<Theme>(()=>{try{return localStorage.getItem('nexora-theme')==='light'?'light':'dark'}catch{return 'dark'}});
 const toggleTheme=()=>setTheme(t=>{const next=t==='dark'?'light':'dark';try{localStorage.setItem('nexora-theme',next)}catch{}return next});
 React.useEffect(()=>{document.documentElement.dataset.nxTheme=theme;document.documentElement.style.colorScheme=theme;applyDesign(loadDesign())},[theme]);
 const navigate=(next:Page)=>{setPage(next);const path=next==='dashboard'?'/dashboard':next==='markets'?'/markets':'/trade/spot';if(window.location.pathname!==path)window.history.pushState({page:next},'',path);window.scrollTo(0,0)};
 React.useEffect(()=>{const listener=()=>setPage(window.location.pathname.startsWith('/dashboard')?'dashboard':window.location.pathname.startsWith('/markets')?'markets':'trade');window.addEventListener('popstate',listener);return()=>window.removeEventListener('popstate',listener)},[]);
 const trade=(selected:SpotPair)=>{setPair(selected);navigate('trade')};
 return <><Header page={page} setPage={navigate} theme={theme} toggleTheme={toggleTheme}/>{page==='dashboard'?<CustomizationDashboard/>:page==='markets'?<MarketsPage pairs={pairs} tickers={tickers} ready={pricesReady} onTrade={trade}/>:<ActiveMarket key={pair.symbol} pair={pair} onSelect={setPair} pairs={pairs} source={source} tickers={tickers} pricesReady={pricesReady}/>}<footer>NEXORA Spot · Live public market data</footer></>}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
