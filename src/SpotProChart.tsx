import { useEffect, useRef, useState } from 'react';
import { Chart, sma, ema, bollingerBands, vwap, ichimoku, supertrend, sar, envelope, emaRibbon, twap, smc, rsi, macd, stochastic, atr, obv, adx, mfi, williamsR, roc, cvd } from '@mg-exchange/charts';
import type { Bar, Datafeed, Timeframe, Indicator, ChartType } from '@mg-exchange/charts';
import type { SpotPair } from './spot-markets';
import './SpotProChart.css';

type BybitRow = [string,string,string,string,string,string,string,...unknown[]];
const intervalMap: Record<string,string> = {'1m':'1','5m':'5','15m':'15','30m':'30','1H':'60','4H':'240','1D':'D','1W':'W'};
const intervals: Timeframe[] = ['1m','5m','15m','30m','1H','4H','1D','1W'];
const indicatorList: {key:string;label:string;indicator:Indicator}[] = [
 {key:'SMA',label:'Simple Moving Average',indicator:sma},{key:'EMA',label:'Exponential Moving Average',indicator:ema},
 {key:'BB',label:'Bollinger Bands',indicator:bollingerBands},{key:'VWAP',label:'VWAP',indicator:vwap},
 {key:'ICH',label:'Ichimoku Cloud',indicator:ichimoku},{key:'ST',label:'Supertrend',indicator:supertrend},
 {key:'SAR',label:'Parabolic SAR',indicator:sar},{key:'ENV',label:'Envelope',indicator:envelope},
 {key:'RIBBON',label:'EMA Ribbon',indicator:emaRibbon},{key:'TWAP',label:'TWAP',indicator:twap},
 {key:'SMC',label:'Smart Money Concepts',indicator:smc},{key:'RSI',label:'RSI',indicator:rsi},
 {key:'MACD',label:'MACD',indicator:macd},{key:'STOCH',label:'Stochastic',indicator:stochastic},
 {key:'ATR',label:'ATR',indicator:atr},{key:'OBV',label:'On Balance Volume',indicator:obv},
 {key:'ADX',label:'ADX',indicator:adx},{key:'MFI',label:'Money Flow Index',indicator:mfi},
 {key:'WR',label:'Williams %R',indicator:williamsR},{key:'ROC',label:'Rate of Change',indicator:roc},
 {key:'CVD',label:'Cumulative Volume Delta (OHLCV estimate)',indicator:cvd}
];
const drawingGroups: {label:string;tools:[string,string][]}[] = [
 {label:'Lines',tools:[['trend-line','Trend Line'],['ray','Ray'],['extended-line','Extended Line'],['horizontal-line','Horizontal Line'],['horizontal-ray','Horizontal Ray'],['vertical-line','Vertical Line'],['cross-line','Cross Line'],['info-line','Info Line'],['polyline','Polyline'],['trend-angle','Trend Angle']]},
 {label:'Channels',tools:[['parallel-channel','Parallel Channel'],['regression-channel','Regression Channel'],['pitchfork','Pitchfork'],['schiff-pitchfork','Schiff Pitchfork'],['modified-schiff-pitchfork','Modified Schiff Pitchfork'],['inside-pitchfork','Inside Pitchfork'],['disjoint-channel','Disjoint Channel']]},
 {label:'Fibonacci',tools:[['fib-retracement','Retracement'],['fib-extension','Extension'],['fib-channel','Channel'],['fib-timezone','Time Zone'],['fib-speed-fan','Speed Fan'],['fib-circles','Circles'],['fib-spiral','Spiral'],['fib-arcs','Arcs'],['fib-wedge','Wedge'],['trend-fib-extension','Trend Extension'],['trend-fib-time','Trend Time']]},
 {label:'Gann & Cycles',tools:[['gann-box','Gann Box'],['gann-fan','Gann Fan'],['gann-square','Gann Square'],['gann-square-fixed','Fixed Gann Square'],['cyclic-lines','Cyclic Lines'],['time-cycles','Time Cycles'],['sine-line','Sine Line']]},
 {label:'Patterns',tools:[['xabcd-pattern','XABCD'],['abcd-pattern','ABCD'],['head-shoulders','Head & Shoulders'],['three-drives','Three Drives'],['cypher-pattern','Cypher'],['elliott-impulse','Elliott Impulse'],['elliott-correction','Elliott Correction'],['elliott-triangle','Elliott Triangle'],['elliott-double-combo','Elliott Double Combo'],['elliott-triple-combo','Elliott Triple Combo'],['triangle','Triangle'],['flat-top-bottom','Flat Top/Bottom'],['bars-pattern','Bars Pattern']]},
 {label:'Shapes & Text',tools:[['rectangle','Rectangle'],['ellipse','Ellipse'],['arc','Arc'],['arrow','Arrow'],['brush','Brush'],['text','Text'],['text-annotation','Text Annotation'],['note','Note'],['callout','Callout'],['flag-marker','Flag']]},
 {label:'Trading & Measure',tools:[['long-short','Long/Short Position'],['price-range','Price Range'],['date-range','Date Range'],['date-price-range','Date + Price Range'],['forecast','Forecast'],['fixed-range-vp','Fixed Range Volume Profile'],['anchored-vwap','Anchored VWAP']]}
];
function parseRow(raw:unknown):Bar|null{
 if(!Array.isArray(raw)||raw.length<6)return null;
 const time=Number(raw[0])/1000,open=Number(raw[1]),high=Number(raw[2]),low=Number(raw[3]),close=Number(raw[4]),volume=Number(raw[5]);
 if(![time,open,high,low,close,volume].every(Number.isFinite)||time<=0||open<=0||low<=0||high<low||close<=0||volume<0)return null;
 return {time,open,high,low,close,volume};
}
class BybitMGDatafeed implements Datafeed{
 constructor(private symbol:string){}
 async getBars({symbol,timeframe,from,to,limit}:{symbol:string;timeframe:Timeframe;from:number;to:number;limit:number}):Promise<Bar[]>{
  if(symbol!==this.symbol||!/^[A-Z0-9]{2,32}$/.test(symbol))return [];
  const i=intervalMap[timeframe]||'60';
  const query=new URLSearchParams({category:'spot',symbol,interval:i,limit:String(Math.min(Math.max(limit||500,1),1000))});
  if(to>0)query.set('end',String(Math.floor(to*1000)));
  if(from>0&&to>from)query.set('start',String(Math.floor(from*1000)));
  const urls=['/kline-cache/'+symbol+'/'+i+'.json','https://api.bybit.com/v5/market/kline?'+query];
  for(const url of urls){
   const ac=new AbortController(),timeout=setTimeout(()=>ac.abort(),url.startsWith('/')?3500:7000);
   try{
    const response=await fetch(url,{signal:ac.signal,cache:url.startsWith('/')?'no-cache':'default'});
    if(!response.ok)continue;
    const json=await response.json() as {generatedAt?:number;retCode?:number;list?:unknown[];result?:{list?:unknown[]}};
    if(url.startsWith('/')&&(!json.generatedAt||Date.now()-json.generatedAt>36*3600000))continue;
    if(!url.startsWith('/')&&json.retCode!==0)continue;
    const source=url.startsWith('/')?json.list:json.result?.list;
    if(!Array.isArray(source))continue;
    const bars=source.map(parseRow).filter((v):v is Bar=>v!==null).sort((a,b)=>a.time-b.time);
    const unique=bars.filter((b,k)=>k===0||b.time!==bars[k-1].time);
    if(unique.length)return unique;
   }catch{/* Use next verified real-data source. */}finally{clearTimeout(timeout)}
  }
  return [];
 }
 subscribe({symbol,timeframe,onBar,onTick}:{symbol:string;timeframe:Timeframe;onBar:(bar:Bar)=>void;onTick:(tick:{time:number;price:number;volume:number})=>void}){
  if(symbol!==this.symbol||!/^[A-Z0-9]{2,32}$/.test(symbol))return ()=>{};
  const topic='kline.'+(intervalMap[timeframe]||'60')+'.'+symbol;
  const ws=new WebSocket('wss://stream.bybit.com/v5/public/spot');
  ws.onopen=()=>ws.send(JSON.stringify({op:'subscribe',args:[topic]}));
  ws.onmessage=e=>{try{
   const message=JSON.parse(e.data) as {topic?:string;data?:Array<{start:number;open:string;high:string;low:string;close:string;volume:string;confirm?:boolean}>};
   if(message.topic!==topic||!Array.isArray(message.data))return;
   for(const d of message.data){
    const b=parseRow([d.start,d.open,d.high,d.low,d.close,d.volume]);
    if(b){onBar(b);onTick({time:Math.floor(Date.now()/1000),price:b.close,volume:0})}
   }
  }catch{/* Ignore malformed messages. */}};
  return ()=>{ws.onopen=null;ws.onmessage=null;ws.close()};
 }
 async searchSymbols(query:string){return this.symbol.includes(query.toUpperCase())?[{symbol:this.symbol,name:this.symbol,exchange:'Bybit',type:'spot' as const,pricePrecision:8,qtyPrecision:8,minMove:0.00000001}]:[]}
}
const readStored=(key:string)=>{try{return JSON.parse(localStorage.getItem(key)||'null') as {drawings?:object[];indicators?:string[];volumeProfile?:boolean}|null}catch{return null}};
export default function SpotProChart({pair,frame,livePrice}:{pair:SpotPair;frame:string;livePrice:number|null}){
 const holder=useRef<HTMLDivElement>(null);
 const chart=useRef<Chart|null>(null);
 const instanceIds=useRef<Map<string,string>>(new Map());
 const [error,setError]=useState<string|null>(null);
 const [indicatorMenu,setIndicatorMenu]=useState(false);
 const [drawMenu,setDrawMenu]=useState(false);
 const [activeTools,setActiveTools]=useState<string|null>(null);
 const [chosen,setChosen]=useState<string[]>(['SMA']);
 const [vp,setVp]=useState(false);
 const [kind,setKind]=useState<ChartType>('candlestick');
 const [drawSearch,setDrawSearch]=useState('');
 const [indSearch,setIndSearch]=useState('');
 const key='nexora:mg-chart:'+pair.symbol;
 const save=()=>{const c=chart.current;if(!c)return;try{localStorage.setItem(key,JSON.stringify({drawings:c.getDrawings(),indicators:[...instanceIds.current.keys()],volumeProfile:vp}))}catch{/* Private browsing or full storage */}};
 useEffect(()=>{
  const node=holder.current;if(!node)return;
  let disposed=false;
  setError(null);
  const saved=readStored(key);
  if(saved?.indicators)setChosen(saved.indicators.filter(k=>indicatorList.some(i=>i.key===k)));
  setVp(Boolean(saved?.volumeProfile));
  const next=new Chart({container:node,symbol:pair.symbol,timeframe:(intervals.find(t=>t.toLowerCase()===frame.toLowerCase())||'1H'),datafeed:new BybitMGDatafeed(pair.symbol),theme:document.documentElement.dataset.nxTheme==='light'?'light':'dark',renderer:'webgl',features:{volume:true},trading:{showPlusButton:false,showContextMenu:false,draggableOrderLines:false}});
  if(disposed){next.destroy();return}
  chart.current=next;
  instanceIds.current.clear();
  const items=(saved?.indicators||['SMA']).filter(k=>indicatorList.some(i=>i.key===k));
  for(const k of items){const entry=indicatorList.find(i=>i.key===k);if(entry){try{instanceIds.current.set(k,next.addIndicator(entry.indicator))}catch(e){console.warn('[NEXORA] Indicator failed:',k,e)}}}
  if(saved?.volumeProfile)next.setVolumeProfile(true);
  if(saved?.drawings?.length){try{next.loadDrawings(saved.drawings)}catch(e){console.warn('[NEXORA] Drawing restore failed',e)}}
  const observer=new MutationObserver(()=>next.setTheme(document.documentElement.dataset.nxTheme==='light'?'light':'dark'));
  observer.observe(document.documentElement,{attributes:true,attributeFilter:['data-nx-theme']});
  const timer=window.setInterval(()=>{try{localStorage.setItem(key,JSON.stringify({drawings:next.getDrawings(),indicators:[...instanceIds.current.keys()],volumeProfile:saved?.volumeProfile||false}))}catch{/* storage inaccessible */}},3000);
  return ()=>{disposed=true;window.clearInterval(timer);observer.disconnect();try{localStorage.setItem(key,JSON.stringify({drawings:next.getDrawings(),indicators:[...instanceIds.current.keys()],volumeProfile:saved?.volumeProfile||false}))}catch{/* ignore */}next.destroy();if(chart.current===next)chart.current=null;instanceIds.current.clear()};
 },[pair.symbol,frame]);
 const toggleIndicator=(k:string)=>{const c=chart.current,entry=indicatorList.find(i=>i.key===k);if(!c||!entry)return;try{const ids=instanceIds.current;if(ids.has(k)){c.removeIndicator(ids.get(k)!);ids.delete(k)}else ids.set(k,c.addIndicator(entry.indicator));setChosen([...ids.keys()]);}catch(e){setError('Indicator could not be added: '+String(e))}};
 const chooseTool=(name:string|null)=>{try{chart.current?.setDrawingTool(name);setActiveTools(name);setDrawMenu(false)}catch(e){setError('Drawing tool failed: '+String(e))}};
 const toggleVP=()=>{const n=!vp;chart.current?.setVolumeProfile(n);setVp(n)};
 return <div className="nexora-mg-chart">
   <div className="nexora-mg-toolbar">
    <span className="mg-market-label">{pair.base}/{pair.quote}</span>
    <div className="mg-intervals">{intervals.map(t=><button key={t} className={t.toLowerCase()===frame.toLowerCase()?'selected':''} type="button" title={'Current timeframe: '+frame} disabled={t.toLowerCase()!==frame.toLowerCase()}>{t}</button>)}</div>
    <select aria-label="Chart type" value={kind} onChange={e=>{const k=e.target.value as ChartType;setKind(k);chart.current?.setChartType(k)}}><option value="candlestick">Candles</option><option value="heikin_ashi">Heikin Ashi</option><option value="bar">OHLC Bars</option><option value="line">Line</option><option value="area">Area</option><option value="baseline">Baseline</option><option value="hollow_candle">Hollow Candles</option></select>
    <button type="button" className={indicatorMenu?'selected':''} onClick={()=>{setIndicatorMenu(!indicatorMenu);setDrawMenu(false)}}>Indicators ({chosen.length}) ▾</button>
    <button type="button" className={drawMenu?'selected':''} onClick={()=>{setDrawMenu(!drawMenu);setIndicatorMenu(false)}}>Draw ▾</button>
    <button type="button" className={vp?'selected':''} onClick={toggleVP}>Volume Profile</button>
    <div className="mg-toolbar-spacer"/>
    <button type="button" onClick={()=>chart.current?.goToLive()} title="Go to live price">Live</button>
    <button type="button" onClick={()=>chart.current?.exportPNG('NEXORA-'+pair.symbol+'.png')} title="Save chart image">Screenshot</button>
    <button type="button" onClick={()=>{if(window.confirm('Clear all drawings for '+pair.symbol+'?')){chart.current?.clearDrawings();save()}}} title="Remove drawings">Clear Drawings</button>
   </div>
   <div className="nexora-mg-stage">
    <aside className="nexora-mg-rail"><button className={!activeTools?'selected':''} onClick={()=>chooseTool(null)} title="Cursor">↖</button>{drawingGroups.map(g=><button key={g.label} className={g.tools.some(t=>t[0]===activeTools)?'selected':''} type="button" title={g.label} onClick={()=>{setDrawMenu(true);setIndicatorMenu(false)}}>{g.label==='Lines'?'╱':g.label==='Channels'?'☷':g.label==='Fibonacci'?'ϕ':g.label==='Gann & Cycles'?'⌁':g.label==='Patterns'?'⌯':g.label==='Shapes & Text'?'▭':'↕'}</button>)}</aside>
    <div className="nexora-mg-render" ref={holder}/>
    {error&&<div className="nexora-mg-error" role="alert">{error}<button onClick={()=>setError(null)}>Dismiss</button></div>}
    {indicatorMenu&&<section className="nexora-mg-popover mg-indicator-popover"><header><strong>Indicators</strong><button onClick={()=>setIndicatorMenu(false)}>×</button></header><input value={indSearch} placeholder="Search indicators..." onChange={e=>setIndSearch(e.target.value)}/><div className="nexora-mg-options">{indicatorList.filter(i=>i.label.toLowerCase().includes(indSearch.toLowerCase())||i.key.toLowerCase().includes(indSearch.toLowerCase())).map(i=><button key={i.key} className={chosen.includes(i.key)?'selected':''} onClick={()=>toggleIndicator(i.key)}><span>{i.label}</span><span>{chosen.includes(i.key)?'✓':'+'}</span></button>)}</div></section>}
    {drawMenu&&<section className="nexora-mg-popover mg-draw-popover"><header><strong>Drawing Tools</strong><button onClick={()=>setDrawMenu(false)}>×</button></header><input value={drawSearch} placeholder="Search drawing tools..." onChange={e=>setDrawSearch(e.target.value)}/><div className="nexora-mg-options"><button onClick={()=>chooseTool(null)}>Cursor / Cancel tool</button>{drawingGroups.map(g=><div key={g.label}><h4>{g.label}</h4>{g.tools.filter(t=>t[1].toLowerCase().includes(drawSearch.toLowerCase())).map(t=><button key={t[0]} className={activeTools===t[0]?'selected':''} onClick={()=>chooseTool(t[0])}>{t[1]}</button>)}</div>)}</div></section>}
   </div>
   <div className="nexora-mg-footer"><span>MG Exchange Chart · Bybit Spot Market Data</span><span>{activeTools?'Drawing: '+activeTools:'Chart'} {livePrice!==null?'· Real-time market':'· Awaiting ticker'}</span></div>
 </div>
}
