import React, { useState } from 'react';
import {useSpotMarkets,useFilteredPairs,type SpotPair} from './spot-markets';
import {useSpotTickers,type MarketTicker} from './spot-tickers';
import {TokenIcon} from './TokenIcon';
import {useTokenOverview} from './useTokenOverview';
import { createRoot } from 'react-dom/client';
import './styles.css';
import {useBybitSpotBook} from './useBybitSpotBook';
const LOGO="data:image/webp;base64,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";
type BookSide='buy'|'sell';
function Brand(){return <div className="brand"><img src={LOGO} alt="NEXORA" /><strong>NEXORA</strong></div>}
function Header(){return <header className="topbar"><Brand/><nav className="toplinks"><button className="selected">Trade</button><button>Markets</button><button>Spot</button><button>Futures</button><button>Assets</button><button>Orders</button></nav><div className="topright"><span className="muted">English / USD</span><button className="outline">Log In</button><button className="primary">Sign Up</button></div></header>}
const display='—';
function MarketBar({pair,onSelect,pairs,source,tickers,pricesReady}:{pair:SpotPair;onSelect:(pair:SpotPair)=>void;pairs:SpotPair[];source:'loading'|'live'|'fallback';tickers:Record<string,MarketTicker>;pricesReady:boolean}){
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
 const selectedTicker=tickers[pair.symbol];
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
 </div><div className={'price market-last '+changeClass}><strong>{marketPrice(selectedTicker?.lastPrice)}</strong><small>{selectedTicker?'≈'+marketPrice(selectedTicker.lastPrice)+' '+pair.quote:'Last price'}</small></div>
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
function ChartPanel({pair}:{pair:SpotPair}){const [tab,setTab]=useState<(typeof tabs)[number]>('Chart');const [frame,setFrame]=useState('1h');return <section className="panel chart"><div className="tabs">{tabs.map(x=><button key={x} onClick={()=>setTab(x)} className={tab===x?'active':''}>{x}</button>)}<span className="paneltools">⚙　⛶</span></div>{tab==='Info'?<TokenInfoPanel pair={pair}/>:tab==='Chart'?<><div className="chart-toolbar"><span className="active-blue">Trading Chart</span><div className="timeframes">{['1m','5m','15m','30m','1h','4h','1d','1w'].map(x=><button key={x} onClick={()=>setFrame(x)} className={frame===x?'on':''}>{x}</button>)}</div><span className="muted">Indicators　⌄</span></div><div className="chart-area"><div className="chart-grid"/><div className="chart-message"><span className="chart-icon">▥</span><b>Chart ready for market-data integration</b><p>React chart container · {frame} · {pair.base}/{pair.quote}</p><small>No simulated candles or prices are displayed.</small></div><span className="axis axis-top">Price ({pair.quote})</span><span className="axis axis-bottom">Time (UTC)</span></div></>:<div className="waiting">{tab} panel · React component ready for live data</div>}</section>}
function OrderBook({pair}:{pair:SpotPair}){
 const [mode,setMode]=useState('Order Book');
 const [stepMultiplier,setStepMultiplier]=useState(1);
 const [layout,setLayout]=useState<'both'|'split'|'bids'|'asks'>('both');
 const book=useBybitSpotBook(pair.symbol);
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
 const bestAsk=book.asks[0]?.price,bestBid=book.bids[0]?.price;
 const last=book.trades[0],mid=last?.price??bestBid??null;
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
  <div className={'midprice '+(last?.side==='Buy'?'up':'down')}><span>{mid!==null?priceText(mid,rawPrecision):display}</span><small>{mid!==null?'≈ '+priceText(mid,rawPrecision)+' '+pair.quote:'USDT'}</small></div>
  {layout!=='asks'&&<div className={'depthblock '+(layout==='split'?'split-bids':'')}><div className="book-rows">{book.synchronized?drawRows(bids,'bid'):<div className="depth-placeholder">{book.error||'Waiting for Bybit snapshot…'}</div>}</div></div>}
  <div className="book-ratio" aria-label="Displayed depth buy sell proportions"><div className="ratio-buy" style={{width:buyPercent+'%'}}>B&nbsp; {book.synchronized?buyPercent+'%':'—'}</div><div className="ratio-sell" style={{width:(100-buyPercent)+'%'}}>{book.synchronized?(100-buyPercent)+'%':'—'} &nbsp;S</div></div>
 </>:<div className="recent-trades"><div className="obhead book-columns"><span>Price ({pair.quote})</span><span>Qty ({pair.base})</span><span>Time</span></div>{book.trades.length?book.trades.slice(0,35).map(t=><div className={'book-row '+(t.side==='Buy'?'bid':'ask')} key={t.id}><span className="book-number book-price">{priceText(t.price)}</span><span className="book-number">{qtyText(t.amount)}</span><span className="book-number">{new Date(t.timestamp).toLocaleTimeString('en-GB')}</span></div>):<div className="waiting">Waiting for public trades…</div>}</div>}
 </section>;
}
function TradingForm({side,pair}:{side:BookSide;pair:SpotPair}){const [kind,setKind]=useState('Limit');const [price,setPrice]=useState('');const [amount,setAmount]=useState('');const [percent,setPercent]=useState(0);return <div className="tradeform"><div className="formcaption"><span>Available</span><span>— {side==='buy'?pair.quote:pair.base}</span></div><div className="ordertypes">{['Limit','Market','Stop Limit'].map(x=><button key={x} onClick={()=>setKind(x)} className={kind===x?'active':''}>{x}</button>)}</div>{kind!=='Market'&&<label className="field"><span>Price</span><input type="number" min="0" placeholder="Enter price" value={price} onChange={e=>setPrice(e.target.value)}/><strong>{pair.quote}</strong></label>}<label className="field"><span>Amount</span><input type="number" min="0" placeholder="Enter amount" value={amount} onChange={e=>setAmount(e.target.value)}/><strong>{pair.base}</strong></label><input className="percentage" type="range" min="0" max="100" step="25" value={percent} onChange={e=>setPercent(Number(e.target.value))}/><div className="rangelabel"><span>0%</span><span>25%</span><span>50%</span><span>75%</span><span>100%</span></div><div className="formcaption"><span>Total</span><span>— {pair.quote}</span></div><button className={'tradeaction '+side} disabled>{side==='buy'?'Buy '+pair.base:'Sell '+pair.base}</button><p className="loginprompt">Trading requires account connection</p></div>}
function TradePanel({pair}:{pair:SpotPair}){const [side,setSide]=useState<BookSide>('buy');return <section className="panel tradepanel"><div className="tabs compact"><button className="active">Spot</button><button>Margin</button></div><div className="sidepicker"><button className={side==='buy'?'buy chosen':''} onClick={()=>setSide('buy')}>Buy</button><button className={side==='sell'?'sell chosen':''} onClick={()=>setSide('sell')}>Sell</button></div><TradingForm side={side} pair={pair}/></section>}
function Orders(){const [tab,setTab]=useState('Open Orders (0)');return <section className="panel orders"><div className="tabs compact">{['Open Orders (0)','Order History','Trade History','Assets'].map(x=><button key={x} className={tab===x?'active':''} onClick={()=>setTab(x)}>{x}</button>)}</div><div className="orders-empty">Sign in to view your {tab.toLowerCase()}</div></section>}
function App(){const {pairs,source}=useSpotMarkets();const {tickers,ready:pricesReady}=useSpotTickers();const [pair,setPair]=useState<SpotPair>({symbol:'BTCUSDT',base:'BTC',quote:'USDT'});return <><Header/><main><MarketBar pair={pair} onSelect={setPair} pairs={pairs} source={source} tickers={tickers} pricesReady={pricesReady}/><div className="workspace"><ChartPanel pair={pair}/><OrderBook key={pair.symbol} pair={pair}/><TradePanel pair={pair}/><Orders/></div></main><footer>NEXORA Spot · Public Bybit market catalog and orderbook</footer></>}
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
