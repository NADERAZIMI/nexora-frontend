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
  if(!/^[A-Z0-9]{2,32}$/.test(symbol))return [];
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
    const unique=bars.filter((b,k)=> (k===0||b.time!==bars[k-1].time) && (!from||b.time>=from) && (!to||b.time<=to));
    if(unique.length)return unique;
   }catch{/* Use next verified real-data source. */}finally{clearTimeout(timeout)}
  }
  return [];
 }
 subscribe({symbol,timeframe,onBar,onTick}:{symbol:string;timeframe:Timeframe;onBar:(bar:Bar)=>void;onTick:(tick:{time:number;price:number;volume:number})=>void}){
  if(!/^[A-Z0-9]{2,32}$/.test(symbol))return ()=>{};
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
 const [objectsOpen,setObjectsOpen]=useState(false);
 const [alertsOpen,setAlertsOpen]=useState(false);
 const [alertPrice,setAlertPrice]=useState('');
 const [alerts,setAlerts]=useState<{id:string;price:number}[]>([]);
 const [compareOpen,setCompareOpen]=useState(false);
 const [compareSymbol,setCompareSymbol]=useState('');
 const [compared,setCompared]=useState<string[]>([]);
 const [settingsOpen,setSettingsOpen]=useState<string|null>(null);
 const [params,setParams]=useState<Record<string,Record<string,number>>>({});
 const [favorites,setFavorites]=useState<string[]>([]);
 const [magnet,setMagnet]=useState(false);
 const [stayDrawing,setStayDrawing]=useState(false);
 const [drawVersion,setDrawVersion]=useState(0);
 const root=useRef<HTMLDivElement>(null);
 const [allDrawingsLocked,setAllDrawingsLocked]=useState(false);
 const [allDrawingsHidden,setAllDrawingsHidden]=useState(false);
 const [drawingColor,setDrawingColor]=useState('#3D6BFF');
 const [drawingWidth,setDrawingWidth]=useState(2);
 const [selectedDrawing,setSelectedDrawing]=useState<string|null>(null);
 const [priceScale,setPriceScale]=useState<'linear'|'logarithmic'|'percentage'>('linear');
 const [localFrame,setLocalFrame]=useState<Timeframe>(intervals.find(t=>t.toLowerCase()===frame.toLowerCase())||'1H');
 const vpRef=useRef(false);
 const paramRef=useRef<Record<string,Record<string,number>>>({});
 const key='nexora:mg-chart:'+pair.symbol;
 const save=()=>{const c=chart.current;if(!c)return;try{localStorage.setItem(key,JSON.stringify({drawings:c.getDrawings(),indicators:[...instanceIds.current.keys()],volumeProfile:vpRef.current,params:paramRef.current}))}catch{/* Private browsing or full storage */}};
 useEffect(()=>{
  const node=holder.current;if(!node)return;
  let disposed=false;
  setError(null);
  const saved=readStored(key);
  if(saved?.indicators)setChosen(saved.indicators.filter(k=>indicatorList.some(i=>i.key===k)));
  setLocalFrame(intervals.find(t=>t.toLowerCase()===frame.toLowerCase())||'1H');
  setVp(Boolean(saved?.volumeProfile));vpRef.current=Boolean(saved?.volumeProfile);
  const extra=saved as typeof saved & {params?:Record<string,Record<string,number>>;favorites?:string[]};
  paramRef.current=extra?.params||{};setParams(paramRef.current);
  try{setFavorites(JSON.parse(localStorage.getItem('nexora:mg-favorites')||'[]'))}catch{setFavorites([])}
  const next=new Chart({container:node,symbol:pair.symbol,timeframe:(intervals.find(t=>t.toLowerCase()===frame.toLowerCase())||'1H'),datafeed:new BybitMGDatafeed(pair.symbol),theme:document.documentElement.dataset.nxTheme==='light'?'light':'dark',renderer:'webgl',features:{volume:true},trading:{showPlusButton:false,showContextMenu:false,draggableOrderLines:false}});
  if(disposed){next.destroy();return}
  chart.current=next;
  instanceIds.current.clear();
  const items=(saved?.indicators||['SMA']).filter(k=>indicatorList.some(i=>i.key===k));
  for(const k of items){const entry=indicatorList.find(i=>i.key===k);if(entry){try{instanceIds.current.set(k,next.addIndicator(entry.indicator,paramRef.current[k]))}catch(e){console.warn('[NEXORA] Indicator failed:',k,e)}}}
  if(saved?.volumeProfile)next.setVolumeProfile(true);
  if(saved?.drawings?.length){try{next.loadDrawings(saved.drawings)}catch(e){console.warn('[NEXORA] Drawing restore failed',e)}}
  for(const event of ['drawingAdded','drawingRemoved','drawingModified','drawingSelected'] as const)next.on(event,()=>setDrawVersion(v=>v+1));
  const observer=new MutationObserver(()=>next.setTheme(document.documentElement.dataset.nxTheme==='light'?'light':'dark'));
  observer.observe(document.documentElement,{attributes:true,attributeFilter:['data-nx-theme']});
  const timer=window.setInterval(()=>{try{localStorage.setItem(key,JSON.stringify({drawings:next.getDrawings(),indicators:[...instanceIds.current.keys()],volumeProfile:vpRef.current,params:paramRef.current}))}catch{/* storage inaccessible */}},3000);
  return ()=>{disposed=true;window.clearInterval(timer);observer.disconnect();try{localStorage.setItem(key,JSON.stringify({drawings:next.getDrawings(),indicators:[...instanceIds.current.keys()],volumeProfile:vpRef.current,params:paramRef.current}))}catch{/* ignore */}next.destroy();if(chart.current===next)chart.current=null;instanceIds.current.clear()};
 },[pair.symbol,frame]);
 const toggleIndicator=(k:string)=>{const c=chart.current,entry=indicatorList.find(i=>i.key===k);if(!c||!entry)return;try{const ids=instanceIds.current;if(ids.has(k)){c.removeIndicator(ids.get(k)!);ids.delete(k)}else ids.set(k,c.addIndicator(entry.indicator,paramRef.current[k]));setChosen([...ids.keys()]);}catch(e){setError('Indicator could not be added: '+String(e))}};
 const chooseTool=(name:string|null)=>{try{chart.current?.setDrawingTool(name);setActiveTools(name);setDrawMenu(false)}catch(e){setError('Drawing tool failed: '+String(e))}};
 const toggleVP=()=>{const n=!vp;chart.current?.setVolumeProfile(n);vpRef.current=n;setVp(n)};
 const toggleFavorite=(k:string)=>setFavorites(v=>{const next=v.includes(k)?v.filter(x=>x!==k):[...v,k];try{localStorage.setItem('nexora:mg-favorites',JSON.stringify(next))}catch{}return next});
 const applyParams=(k:string,values:Record<string,number>)=>{const entry=indicatorList.find(i=>i.key===k),c=chart.current;if(!entry||!c)return;try{paramRef.current={...paramRef.current,[k]:values};setParams(paramRef.current);const id=instanceIds.current.get(k);if(id)c.removeIndicator(id);instanceIds.current.set(k,c.addIndicator(entry.indicator,values));setChosen([...instanceIds.current.keys()]);setSettingsOpen(null);save()}catch(e){setError(String(e))}};
 const items=(()=>{void drawVersion;try{return chart.current?.getDrawingInstances()||[]}catch{return []}})() as Array<{id:string;toolName:string;visible:boolean;locked:boolean}>;
 const drawingAction=(id:string,action:string)=>{const c=chart.current;if(!c)return;try{if(action==='remove')c.removeDrawing(id);else if(action==='visible')c.toggleDrawingVisible(id);else if(action==='lock')c.toggleDrawingLock(id);else if(action==='front')c.bringDrawingToFront(id);else if(action==='back')c.sendDrawingToBack(id);setDrawVersion(v=>v+1);save()}catch(e){setError(String(e))}};
 const addAlert=()=>{const value=Number(alertPrice);if(!Number.isFinite(value)||value<=0){setError('Enter a valid positive price');return}try{const id=chart.current?.addAlert(value);if(id){setAlerts(v=>[...v,{id,price:value}]);setAlertPrice('')}}catch(e){setError(String(e))}};
 const removeAlert=(id:string)=>{try{chart.current?.removeAlert(id);setAlerts(v=>v.filter(a=>a.id!==id))}catch(e){setError(String(e))}};
 const addCompare=async()=>{const symbol=compareSymbol.trim().toUpperCase();if(!/^[A-Z0-9]{2,32}$/.test(symbol)||symbol===pair.symbol){setError('Enter another valid market symbol');return}try{await chart.current?.addCompare(symbol);setCompared(v=>v.includes(symbol)?v:[...v,symbol]);setCompareSymbol('')}catch(e){setError('Symbol comparison failed: '+String(e))}};
 const removeCompare=(symbol:string)=>{chart.current?.removeCompare(symbol);setCompared(v=>v.filter(x=>x!==symbol))};
 const toggleMagnet=()=>{const next=!magnet;chart.current?.setMagnetMode(next);setMagnet(next)};
 const toggleAllLock=()=>{const next=!allDrawingsLocked;if(next)chart.current?.lockAllDrawings();else chart.current?.unlockAllDrawings();setAllDrawingsLocked(next);setDrawVersion(v=>v+1);save()};
 const toggleAllHidden=()=>{const next=!allDrawingsHidden;if(next)chart.current?.hideAllDrawings();else chart.current?.showAllDrawings();setAllDrawingsHidden(next);setDrawVersion(v=>v+1);save()};
 const changeDrawingAppearance=(field:'color'|'lineWidth',value:string|number)=>{if(!selectedDrawing)return;try{chart.current?.updateDrawing(selectedDrawing,{[field]:value});setDrawVersion(v=>v+1);save()}catch(e){setError(String(e))}};
 const toggleFullscreen=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await root.current?.requestFullscreen()}catch(e){setError(String(e))}};
 const toggleStayDrawing=()=>{const next=!stayDrawing;chart.current?.setStayInDrawingMode(next);setStayDrawing(next)};
 return <div ref={root} className="nexora-mg-chart">
   <div className="nexora-mg-toolbar">
    <span className="mg-market-label">{pair.base}/{pair.quote}</span>
    <div className="mg-intervals">{intervals.map(t=><button key={t} className={t===localFrame?'selected':''} type="button" title={'Switch to '+t} onClick={()=>{chart.current?.setTimeframe(t);setLocalFrame(t)}}>{t}</button>)}</div>
    <select aria-label="Chart type" value={kind} onChange={e=>{const k=e.target.value as ChartType;setKind(k);chart.current?.setChartType(k)}}><option value="candlestick">Candles</option><option value="heikin_ashi">Heikin Ashi</option><option value="bar">OHLC Bars</option><option value="line">Line</option><option value="line_markers">Line with Markers</option><option value="step_line">Step Line</option><option value="area">Area</option><option value="hlc_area">HLC Area</option><option value="baseline">Baseline</option><option value="columns">Columns</option><option value="high_low">High-Low</option><option value="hollow_candle">Hollow Candles</option></select>
    <button type="button" className={indicatorMenu?'selected':''} onClick={()=>{setIndicatorMenu(!indicatorMenu);setDrawMenu(false)}}>Indicators ({chosen.length}) ▾</button>
    <button type="button" className={drawMenu?'selected':''} onClick={()=>{setDrawMenu(!drawMenu);setIndicatorMenu(false)}}>Draw ▾</button>
    <button type="button" className={vp?'selected':''} onClick={toggleVP}>Volume Profile</button>
    <button type="button" className={magnet?'selected':''} onClick={toggleMagnet}>Magnet</button><button type="button" className={stayDrawing?'selected':''} onClick={toggleStayDrawing}>Keep Tool</button>
    <button type="button" className={objectsOpen?'selected':''} onClick={()=>setObjectsOpen(v=>!v)}>Objects</button>
    <button type="button" className={alertsOpen?'selected':''} onClick={()=>setAlertsOpen(v=>!v)}>Alerts</button>
    <button type="button" className={compareOpen?'selected':''} onClick={()=>setCompareOpen(v=>!v)}>Compare</button>
    <select aria-label="Price scale" value={priceScale} onChange={e=>{const mode=e.target.value as typeof priceScale;try{chart.current?.setPriceScale(mode);setPriceScale(mode)}catch(err){setError(String(err))}}}><option value="linear">Linear</option><option value="logarithmic">Log</option><option value="percentage">Percent</option></select>
    <button type="button" onClick={toggleAllLock}>{allDrawingsLocked?'Unlock All':'Lock All'}</button>
    <button type="button" onClick={toggleAllHidden}>{allDrawingsHidden?'Show All':'Hide All'}</button>
    <div className="mg-toolbar-spacer"/>
    <button type="button" onClick={()=>chart.current?.goToLive()} title="Go to live price">Live</button>
    <button type="button" onClick={toggleFullscreen}>Fullscreen</button>
    <button type="button" onClick={()=>chart.current?.exportPNG('NEXORA-'+pair.symbol+'.png')} title="Save chart image">Screenshot</button>
    <button type="button" onClick={()=>{if(window.confirm('Clear all drawings for '+pair.symbol+'?')){chart.current?.clearDrawings();save()}}} title="Remove drawings">Clear Drawings</button>
   </div>
   <div className="nexora-mg-stage">
    <aside className="nexora-mg-rail"><button className={!activeTools?'selected':''} onClick={()=>chooseTool(null)} title="Cursor">↖</button>{drawingGroups.map(g=><button key={g.label} className={g.tools.some(t=>t[0]===activeTools)?'selected':''} type="button" title={g.label} onClick={()=>{setDrawMenu(true);setIndicatorMenu(false)}}>{g.label==='Lines'?'╱':g.label==='Channels'?'☷':g.label==='Fibonacci'?'ϕ':g.label==='Gann & Cycles'?'⌁':g.label==='Patterns'?'⌯':g.label==='Shapes & Text'?'▭':'↕'}</button>)}</aside>
    <div className="nexora-mg-render" ref={holder}/>
    {alertsOpen&&<section className="nexora-mg-objects"><header><strong>Price Alerts</strong><button onClick={()=>setAlertsOpen(false)}>×</button></header><div className="mg-sidebar-form"><input aria-label="Alert price" type="number" min="0" step="any" placeholder="Alert price" value={alertPrice} onChange={e=>setAlertPrice(e.target.value)}/><button onClick={addAlert}>Add alert</button></div><div className="nexora-mg-options">{alerts.map(a=><div key={a.id} className="mg-object-row"><span>{a.price}</span><button onClick={()=>removeAlert(a.id)}>Remove</button></div>)}</div></section>}
    {compareOpen&&<section className="nexora-mg-objects"><header><strong>Compare Markets</strong><button onClick={()=>setCompareOpen(false)}>×</button></header><div className="mg-sidebar-form"><input aria-label="Compare market symbol" placeholder="ETHUSDT" value={compareSymbol} onChange={e=>setCompareSymbol(e.target.value)}/><button onClick={addCompare}>Compare</button></div><div className="nexora-mg-options">{compared.map(symbol=><div key={symbol} className="mg-object-row"><span>{symbol}</span><button onClick={()=>removeCompare(symbol)}>Remove</button></div>)}</div></section>}
    {objectsOpen&&<section className="nexora-mg-objects"><header><strong>Objects ({items.length})</strong><button onClick={()=>setObjectsOpen(false)}>×</button></header>{selectedDrawing&&<div className="mg-sidebar-form mg-drawing-style"><label>Color <input type="color" value={drawingColor} onChange={e=>{setDrawingColor(e.target.value);changeDrawingAppearance('color',e.target.value)}}/></label><label>Width <input type="number" min="1" max="12" value={drawingWidth} onChange={e=>{const n=Number(e.target.value);setDrawingWidth(n);changeDrawingAppearance('lineWidth',n)}}/></label></div>}<div className="nexora-mg-options">{items.length===0?<p>No drawings yet</p>:items.map((d,index)=><div className="mg-object-row" key={d.id||index}><button className={selectedDrawing===d.id?'selected':''} title="Select drawing" onClick={()=>setSelectedDrawing(d.id)}>{d.toolName||'Drawing'} #{index+1}</button><div><button title="Show/hide" onClick={()=>drawingAction(d.id,'visible')}>◉</button><button title="Lock/unlock" onClick={()=>drawingAction(d.id,'lock')}>♧</button><button title="Bring forward" onClick={()=>drawingAction(d.id,'front')}>↑</button><button title="Send backward" onClick={()=>drawingAction(d.id,'back')}>↓</button><button title="Delete" onClick={()=>drawingAction(d.id,'remove')}>×</button></div></div>)}</div></section>}
    {error&&<div className="nexora-mg-error" role="alert">{error}<button onClick={()=>setError(null)}>Dismiss</button></div>}
    {indicatorMenu&&<section className="nexora-mg-popover mg-indicator-popover"><header><strong>Indicators</strong><button onClick={()=>setIndicatorMenu(false)}>×</button></header><input value={indSearch} placeholder="Search indicators..." onChange={e=>setIndSearch(e.target.value)}/><div className="nexora-mg-options">{indicatorList.filter(i=>i.label.toLowerCase().includes(indSearch.toLowerCase())||i.key.toLowerCase().includes(indSearch.toLowerCase())).sort((a,b)=>Number(favorites.includes(b.key))-Number(favorites.includes(a.key))).map(i=><div className="mg-indicator-row" key={i.key}><button title="Favorite" onClick={()=>toggleFavorite(i.key)}>{favorites.includes(i.key)?'★':'☆'}</button><button className={chosen.includes(i.key)?'selected':''} onClick={()=>toggleIndicator(i.key)}><span>{i.label}</span><span>{chosen.includes(i.key)?'✓':'+'}</span></button><button title="Settings" onClick={()=>setSettingsOpen(i.key)}>⚙</button></div>)}</div></section>}
    {settingsOpen&&<section className="nexora-mg-popover mg-settings-popover"><header><strong>{indicatorList.find(i=>i.key===settingsOpen)?.label} Settings</strong><button onClick={()=>setSettingsOpen(null)}>×</button></header><form onSubmit={e=>{e.preventDefault();const fd=new FormData(e.currentTarget);const values:Record<string,number>={};for(const [k,v] of fd){const n=Number(v);if(Number.isFinite(n))values[k]=n}applyParams(settingsOpen,values)}}>{Object.entries(params[settingsOpen]||{period:settingsOpen==='EMA'?50:14}).map(([k,v])=><label key={k}>{k}<input name={k} type="number" step="any" defaultValue={v} required/></label>)}<button type="submit">Apply</button></form></section>}
    {drawMenu&&<section className="nexora-mg-popover mg-draw-popover"><header><strong>Drawing Tools</strong><button onClick={()=>setDrawMenu(false)}>×</button></header><input value={drawSearch} placeholder="Search drawing tools..." onChange={e=>setDrawSearch(e.target.value)}/><div className="nexora-mg-options"><button onClick={()=>chooseTool(null)}>Cursor / Cancel tool</button>{drawingGroups.map(g=><div key={g.label}><h4>{g.label}</h4>{g.tools.filter(t=>t[1].toLowerCase().includes(drawSearch.toLowerCase())).map(t=><button key={t[0]} className={activeTools===t[0]?'selected':''} onClick={()=>chooseTool(t[0])}>{t[1]}</button>)}</div>)}</div></section>}
   </div>
   <div className="nexora-mg-footer"><span>MG Exchange Chart · Bybit Spot Market Data</span><span>{activeTools?'Drawing: '+activeTools:'Chart'} {livePrice!==null?'· Real-time market':'· Awaiting ticker'}</span></div>
 </div>
}
