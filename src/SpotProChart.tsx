import { useEffect, useRef, useState } from 'react';
import { Chart, darkTheme, lightTheme, sma, ema, bollingerBands, vwap, ichimoku, supertrend, sar, envelope, emaRibbon, twap, smc, rsi, macd, stochastic, atr, obv, adx, mfi, williamsR, roc, cvd } from '@mg-exchange/charts';
import type { Bar, Datafeed, Timeframe, Indicator, ChartType } from '@mg-exchange/charts';
import type { SpotPair } from './spot-markets';
import './SpotProChart.css';

type BybitRow = [string,string,string,string,string,string,string,...unknown[]];
const intervalMap: Record<string,string> = {'1m':'1','3m':'3','5m':'5','15m':'15','30m':'30','1H':'60','2H':'120','4H':'240','6H':'360','12H':'720','1D':'D','3D':'3D','1W':'W','1M':'M'};
const intervals: Timeframe[] = ['1s','1m','3m','5m','15m','30m','1H','2H','4H','6H','12H','1D','3D','1W','1M'];
const defaultPinned:Timeframe[]=['1s','1m','5m','15m','30m','1H','4H','1D','1W','1M'];
const timeframeKey='nexora:mg-chart:active-timeframe';
const loadTimeframe=():Timeframe=>{try{const value=localStorage.getItem(timeframeKey);return intervals.includes(value as Timeframe)?value as Timeframe:'5m'}catch{return '5m'}};
const sortTimes=(values:Timeframe[])=>[...values].sort((a,b)=>intervals.indexOf(a)-intervals.indexOf(b));
const chartFont='"Inter",system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif';
const nxTheme=(light:boolean)=>({... (light?lightTheme:darkTheme),bg:getComputedStyle(document.documentElement).getPropertyValue('--nx-chart-bg').trim()||getComputedStyle(document.documentElement).getPropertyValue('--nx-surface').trim()||(light?'#FFFFFF':'#101014'),fontFamily:chartFont});
const pinnedKey='nexora:mg-chart:pinned-timeframes';
const pinnedLayoutVersionKey='nexora:mg-chart:pinned-layout-version';
const loadPinned=():Timeframe[]=>{
 try{
  // One-time migration: existing 8-slot layouts must display the new ten standard shortcuts.
  if(localStorage.getItem(pinnedLayoutVersionKey)!=='10'){
   localStorage.setItem(pinnedKey,JSON.stringify(defaultPinned));
   localStorage.setItem(pinnedLayoutVersionKey,'10');
   return defaultPinned;
  }
  const raw:unknown=JSON.parse(localStorage.getItem(pinnedKey)||'null');
  if(!Array.isArray(raw)||!raw.length)return defaultPinned;
  const valid=raw.filter((v:unknown,i:number)=>typeof v==='string'&&intervals.includes(v as Timeframe)&&raw.indexOf(v)===i) as Timeframe[];
  return valid.length?sortTimes(valid.slice(0,10)):defaultPinned;
 }catch{return defaultPinned}
};
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
function StyleIcon({kind}:{kind:ChartType}){switch(kind){case 'bar':return <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round"><path d="M5 4v16M10 7v10M15 3v18M20 7v10"/><path d="M3 8h4m1 5h4m1-5h4m1 5h4"/></svg>;case 'candlestick':return <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round"><path d="M6 2v20M12 2v20M18 2v20"/><rect x="3.5" y="7" width="5" height="8" rx=".5"/><rect x="9.5" y="4" width="5" height="11" rx=".5"/><rect x="15.5" y="10" width="5" height="7" rx=".5"/></svg>;case 'hollow_candle':return <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round"><path d="M6 2v20M12 2v20M18 2v20"/><rect x="3.5" y="7" width="5" height="8" rx=".5"/><rect x="9.5" y="4" width="5" height="11" rx=".5"/><rect x="15.5" y="10" width="5" height="7" rx=".5"/></svg>;case 'heikin_ashi':return <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round"><path d="M6 2v20M12 2v20M18 2v20"/><rect x="3.5" y="7" width="5" height="8" rx=".5"/><rect x="9.5" y="4" width="5" height="11" rx=".5"/><rect x="15.5" y="10" width="5" height="7" rx=".5"/></svg>;case 'line':return <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round"><path d="M2 17l5-5 4 2 5-8 6 2"/></svg>;case 'area':return <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round"><path d="M2 17l5-5 4 2 5-8 6 2v12H2z"/></svg>;case 'baseline':return <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round"><path d="M2 12h20M2 17l5-5 4 2 5-8 6 2"/></svg>;case 'line_markers':return <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round"><path d="M2 17l5-5 4 2 5-8 6 2"/><circle cx="7" cy="12" r="1.5"/><circle cx="16" cy="6" r="1.5"/></svg>;case 'step_line':return <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round"><path d="M2 18h6V9h7V5h7"/></svg>;case 'hlc_area':return <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round"><path d="M2 20V11l5-3 5 5 5-9 5 3v13z"/></svg>;case 'columns':return <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round"><path d="M3 21V11h4v10M10 21V4h4v17M17 21V9h4v12"/></svg>;case 'high_low':return <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round"><path d="M7 3v18m10-18v18M4 7h6M14 16h6"/></svg>;default:return null}}
function RenkoIcon(){return <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M2 18l5-5 5 5 5-5 5 5M2 11l5-5 5 5 5-5 5 5"/></svg>}
function parseRow(raw:unknown):Bar|null{
 if(!Array.isArray(raw)||raw.length<6)return null;
 const time=Number(raw[0])/1000,open=Number(raw[1]),high=Number(raw[2]),low=Number(raw[3]),close=Number(raw[4]),volume=Number(raw[5]);
 if(![time,open,high,low,close,volume].every(Number.isFinite)||time<=0||open<=0||low<=0||high<low||close<=0||volume<0)return null;
 return {time,open,high,low,close,volume};
}
// Continuous one-second OHLC: missing trade-seconds are flat, zero-volume intervals.
function fillSecondGaps(bars:Bar[],maximum=1000):Bar[]{
 if(!bars.length)return [];
 const sorted=[...bars].sort((a,b)=>a.time-b.time);
 const end=sorted[sorted.length-1].time;
 const first=Math.max(sorted[0].time,end-maximum+1);
 const bySecond=new Map(sorted.map(bar=>[bar.time,bar]));
 const result:Bar[]=[];let close=sorted[0].open;
 for(let time=first;time<=end;time++){
  const bar=bySecond.get(time);
  if(bar){result.push(bar);close=bar.close}
  else result.push({time,open:close,high:close,low:close,close,volume:0});
 }
 return result;
}
class BybitMGDatafeed implements Datafeed{
 constructor(private symbol:string){}
 async getBars({symbol,timeframe,from,to,limit}:{symbol:string;timeframe:Timeframe;from:number;to:number;limit:number}):Promise<Bar[]>{
  if(!/^[A-Z0-9]{2,32}$/.test(symbol))return [];
  if(timeframe==='1s'){
   try{
    const response=await fetch('https://api.bybit.com/v5/market/recent-trade?'+new URLSearchParams({category:'spot',symbol,limit:'1000'}));
    if(!response.ok)return [];
    const payload=await response.json() as {retCode?:number;result?:{list?:Array<{T:string;p:string;v:string}>}};
    if(payload.retCode!==0||!Array.isArray(payload.result?.list))return [];
    const result=new Map<number,Bar>();
    for(const trade of [...payload.result.list].reverse()){
     const time=Math.floor(Number(trade.T)/1000),price=Number(trade.p),volume=Number(trade.v);
     if(!Number.isFinite(time)||!Number.isFinite(price)||price<=0||!Number.isFinite(volume)||volume<0)continue;
     if(from&&time<from||to&&time>to)continue;
     const prev=result.get(time);
     if(prev){prev.high=Math.max(prev.high,price);prev.low=Math.min(prev.low,price);prev.close=price;prev.volume+=volume}
     else result.set(time,{time,open:price,high:price,low:price,close:price,volume});
    }
    return fillSecondGaps([...result.values()],Math.min(limit||500,1000));
   }catch{return []}
  }
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
  if(timeframe==='1s'){
   const topic='publicTrade.'+symbol;
   const ws=new WebSocket('wss://stream.bybit.com/v5/public/spot');
   let current:Bar|null=null;
   let disposed=false;
   // Advance one-second candles even when no trades occur; zero-volume flat bars.
   const advance=(second:number)=>{
    if(!current||second<=current.time)return;
    const last=current;
    const count=Math.min(1000,second-last.time);
    for(let t=last.time+1;t<=last.time+count;t++){
     if(disposed)return;
     current={time:t,open:current.close,high:current.close,low:current.close,close:current.close,volume:0};
     onBar(current);
    }
   };
   ws.onopen=()=>ws.send(JSON.stringify({op:'subscribe',args:[topic]}));
   ws.onmessage=event=>{try{
    const msg=JSON.parse(event.data) as {topic?:string;data?:Array<{T:number;p:string;v:string}>};
    if(msg.topic!==topic||!Array.isArray(msg.data))return;
    for(const trade of [...msg.data].sort((a,b)=>Number(a.T)-Number(b.T))){
     const time=Math.floor(Number(trade.T)/1000),price=Number(trade.p),volume=Number(trade.v);
     if(!Number.isFinite(time)||!Number.isFinite(price)||price<=0||!Number.isFinite(volume)||volume<0)continue;
     if(current&&time<current.time)continue;
     if(current&&time>current.time+1)advance(time-1);
     if(!current||current.time!==time)current={time,open:current?.close??price,high:Math.max(current?.close??price,price),low:Math.min(current?.close??price,price),close:price,volume};
     else current={...current,high:Math.max(current.high,price),low:Math.min(current.low,price),close:price,volume:current.volume+volume};
     onBar(current);
    }
   }catch{/* Ignore malformed public trade events */}};
   const timer=window.setInterval(()=>advance(Math.floor(Date.now()/1000)-1),1000);
   return ()=>{disposed=true;window.clearInterval(timer);ws.onopen=null;ws.onmessage=null;ws.close()};
  }
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
// A fixed-size Renko view derived from real spot closes. No synthetic market prices.
class RenkoDatafeed implements Datafeed {
 private box=0;
 private lastClose=0;
 private lastTime=0;
 private lastSourceTime=0;
 private trend=0;
 constructor(private source:BybitMGDatafeed){}
 private accept(bar:Bar):Bar[]{
  if(!this.box){this.box=Math.max(bar.close*.005,1e-10);this.lastClose=bar.close;this.lastSourceTime=bar.time;this.lastTime=bar.time;return []}
  const out:Bar[]=[];
  const movement=bar.close-this.lastClose;
  const direction=Math.sign(movement);
  if(!direction)return out;
  const threshold=this.trend&&direction!==this.trend?2:1;
  const steps=Math.min(500,Math.floor(Math.abs(movement)/this.box));
  if(steps<threshold)return out;
  for(let n=0;n<steps;n++){
   if(n===0&&threshold===2){this.lastClose+=direction*this.box;continue}
   const open=this.lastClose,close=open+direction*this.box;
   this.lastTime=Math.max(this.lastTime+1,bar.time+n);
   out.push({time:this.lastTime,open,high:Math.max(open,close),low:Math.min(open,close),close,volume:bar.volume/Math.max(steps,1)});
   this.lastClose=close;this.trend=direction;
  }
  this.lastSourceTime=bar.time;
  return out;
 }
 async getBars(options:Parameters<Datafeed['getBars']>[0]):Promise<Bar[]>{
  this.box=0;this.lastClose=0;this.lastTime=0;this.trend=0;this.lastSourceTime=0;
  const raw=await this.source.getBars(options);
  const bricks=raw.flatMap(bar=>this.accept(bar));
  return bricks.length?bricks:[];
 }
 subscribe(options:Parameters<Datafeed['subscribe']>[0]){
  return this.source.subscribe({...options,onTick:()=>{},onBar:bar=>{
   if(bar.time<this.lastSourceTime)return;
   const bricks=this.accept(bar);
   bricks.forEach(options.onBar);
  }});
 }
 searchSymbols(query:string){return this.source.searchSymbols(query)}
}
const readStored=(key:string)=>{try{return JSON.parse(localStorage.getItem(key)||'null') as {drawings?:object[];indicators?:string[];volumeProfile?:boolean}|null}catch{return null}};
export default function SpotProChart({pair,frame,livePrice}:{pair:SpotPair;frame:string;livePrice:number|null}){
 const holder=useRef<HTMLDivElement>(null);
 const chart=useRef<Chart|null>(null);
 const instanceIds=useRef<Map<string,string>>(new Map());
 const [error,setError]=useState<string|null>(null);
 const [indicatorMenu,setIndicatorMenu]=useState(false);
 const [chartTypeMenu,setChartTypeMenu]=useState(false);
 const [chartPopupLeft,setChartPopupLeft]=useState(8);
 const [drawMenu,setDrawMenu]=useState(false);
 const [drawingGroup,setDrawingGroup]=useState<string|null>(null);
 const [railSearch,setRailSearch]=useState('');
 const [activeTools,setActiveTools]=useState<string|null>(null);
 const [chosen,setChosen]=useState<string[]>(['SMA']);
 const [vp,setVp]=useState(false);
 const [kind,setKind]=useState<ChartType|'renko'>('candlestick');
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
 const [localFrame,setLocalFrame]=useState<Timeframe>(loadTimeframe);
 const [pinned,setPinned]=useState<Timeframe[]>(loadPinned);
 const [timeframeMenu,setTimeframeMenu]=useState(false);
 const [editPinned,setEditPinned]=useState(false);
 useEffect(()=>{
  if(!timeframeMenu)return;
  const onPointerDown=(event:PointerEvent)=>{
   const target=event.target;
   if(!(target instanceof Node))return;
   const panel=root.current?.querySelector('.mg-timeframe-menu');
   const arrow=root.current?.querySelector('.mg-timeframe-arrow');
   if(!panel?.contains(target)&&!arrow?.contains(target))setTimeframeMenu(false);
  };
  const onContextMenu=()=>setTimeframeMenu(false);
  const onKeyDown=(event:KeyboardEvent)=>{if(event.key==='Escape')setTimeframeMenu(false)};
  document.addEventListener('pointerdown',onPointerDown,true);
  document.addEventListener('contextmenu',onContextMenu,true);
  document.addEventListener('keydown',onKeyDown);
  return ()=>{document.removeEventListener('pointerdown',onPointerDown,true);document.removeEventListener('contextmenu',onContextMenu,true);document.removeEventListener('keydown',onKeyDown)};
 },[timeframeMenu]);
 useEffect(()=>{
  const anyOpen=timeframeMenu||chartTypeMenu||indicatorMenu||drawMenu||drawingGroup!==null||settingsOpen!==null||objectsOpen||alertsOpen||compareOpen;
  if(!anyOpen)return;
  const dismiss=()=>{setTimeframeMenu(false);setChartTypeMenu(false);setIndicatorMenu(false);setDrawMenu(false);setDrawingGroup(null);setSettingsOpen(null);setObjectsOpen(false);setAlertsOpen(false);setCompareOpen(false)};
  const outside=(event:PointerEvent)=>{const target=event.target;if(!(target instanceof Node))return;const host=root.current;if(!host)return;
   const insideMenu=Array.from(host.querySelectorAll('.mg-timeframe-menu,.nexora-mg-popover,.nexora-mg-objects,.mg-rail-flyout')).some(el=>el.contains(target));
   const trigger=Array.from(host.querySelectorAll('.mg-timeframe-arrow,.mg-compact-icon,.nexora-mg-toolbar button,.nexora-mg-rail button')).some(el=>el.contains(target));
   if(!insideMenu&&!trigger)dismiss();
  };
  const rightClick=()=>dismiss();
  const escape=(event:KeyboardEvent)=>{if(event.key==='Escape')dismiss()};
  document.addEventListener('pointerdown',outside,true);document.addEventListener('contextmenu',rightClick,true);document.addEventListener('keydown',escape);
  return()=>{document.removeEventListener('pointerdown',outside,true);document.removeEventListener('contextmenu',rightClick,true);document.removeEventListener('keydown',escape)};
 },[timeframeMenu,chartTypeMenu,indicatorMenu,drawMenu,settingsOpen,objectsOpen,alertsOpen,compareOpen,drawingGroup]);
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

  setVp(Boolean(saved?.volumeProfile));vpRef.current=Boolean(saved?.volumeProfile);
  const extra=saved as typeof saved & {params?:Record<string,Record<string,number>>;favorites?:string[]};
  paramRef.current=extra?.params||{};setParams(paramRef.current);
  try{setFavorites(JSON.parse(localStorage.getItem('nexora:mg-favorites')||'[]'))}catch{setFavorites([])}
  const next=new Chart({container:node,symbol:pair.symbol,timeframe:localFrame,datafeed:kind==='renko'?new RenkoDatafeed(new BybitMGDatafeed(pair.symbol)):new BybitMGDatafeed(pair.symbol),theme:nxTheme(document.documentElement.dataset.nxTheme==='light'),chartType:kind==='renko'?'candlestick':kind,renderer:'webgl',features:{volume:true},trading:{showPlusButton:false,showContextMenu:false,draggableOrderLines:false}});
  if(disposed){next.destroy();return}
  chart.current=next;
  instanceIds.current.clear();
  const items=(saved?.indicators||['SMA']).filter(k=>indicatorList.some(i=>i.key===k));
  for(const k of items){const entry=indicatorList.find(i=>i.key===k);if(entry){try{instanceIds.current.set(k,next.addIndicator(entry.indicator,paramRef.current[k]))}catch(e){console.warn('[NEXORA] Indicator failed:',k,e)}}}
  if(saved?.volumeProfile)next.setVolumeProfile(true);
  if(saved?.drawings?.length){try{next.loadDrawings(saved.drawings)}catch(e){console.warn('[NEXORA] Drawing restore failed',e)}}
  for(const event of ['drawingAdded','drawingRemoved','drawingModified','drawingSelected'] as const)next.on(event,()=>setDrawVersion(v=>v+1));
  const updateChartTheme=()=>next.setTheme(nxTheme(document.documentElement.dataset.nxTheme==='light'));
  const observer=new MutationObserver(updateChartTheme);
  window.addEventListener('nexora:design-change',updateChartTheme);
  observer.observe(document.documentElement,{attributes:true,attributeFilter:['data-nx-theme','style']});
  const timer=window.setInterval(()=>{try{localStorage.setItem(key,JSON.stringify({drawings:next.getDrawings(),indicators:[...instanceIds.current.keys()],volumeProfile:vpRef.current,params:paramRef.current}))}catch{/* storage inaccessible */}},3000);
  return ()=>{disposed=true;window.clearInterval(timer);observer.disconnect();window.removeEventListener('nexora:design-change',updateChartTheme);try{localStorage.setItem(key,JSON.stringify({drawings:next.getDrawings(),indicators:[...instanceIds.current.keys()],volumeProfile:vpRef.current,params:paramRef.current}))}catch{/* ignore */}next.destroy();if(chart.current===next)chart.current=null;instanceIds.current.clear()};
 },[pair.symbol,frame,kind==='renko']);
 const setChartStyle=(type:ChartType|'renko')=>{
  try{
   setKind(type);
   if(type!=='renko')chart.current?.setChartType(type);
   setChartTypeMenu(false);
  }catch(e){setError(String(e))}
 };
 const toggleIndicator=(k:string)=>{const c=chart.current,entry=indicatorList.find(i=>i.key===k);if(!c||!entry)return;try{const ids=instanceIds.current;if(ids.has(k)){c.removeIndicator(ids.get(k)!);ids.delete(k)}else ids.set(k,c.addIndicator(entry.indicator,paramRef.current[k]));setChosen([...ids.keys()]);}catch(e){setError('Indicator could not be added: '+String(e))}};
 const chooseTool=(name:string|null)=>{try{chart.current?.setDrawingTool(name);setActiveTools(name);setDrawMenu(false);setDrawingGroup(null)}catch(e){setError('Drawing tool failed: '+String(e))}};
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
 const changeTimeframe=(timeframe:Timeframe)=>{try{chart.current?.setTimeframe(timeframe);setLocalFrame(timeframe);try{localStorage.setItem(timeframeKey,timeframe)}catch{}setTimeframeMenu(false)}catch(e){setError('Timeframe switch failed: '+String(e))}};
 const togglePinned=(timeframe:Timeframe)=>setPinned(current=>{const updated=current.includes(timeframe)?(current.length>1?current.filter(t=>t!==timeframe):current):(current.length<10?[...current,timeframe]:current);const sorted=sortTimes(updated);try{localStorage.setItem(pinnedKey,JSON.stringify(sorted))}catch{}return sorted});
 const toggleStayDrawing=()=>{const next=!stayDrawing;chart.current?.setStayInDrawingMode(next);setStayDrawing(next)};
 return <div ref={root} className="nexora-mg-chart">
   <div className="nexora-mg-toolbar">
    <div className="mg-intervals">{pinned.map(t=><button key={t} className={t===localFrame?'selected':''} type="button" title={'Switch to '+t} onClick={()=>changeTimeframe(t)}>{t}</button>)}<button className={timeframeMenu?'selected mg-timeframe-arrow':'mg-timeframe-arrow'} aria-label="Choose timeframes" aria-expanded={timeframeMenu} type="button" onClick={()=>{setTimeframeMenu(v=>!v);setChartTypeMenu(false);setIndicatorMenu(false)}}>▾</button></div>
    <button type="button" className={chartTypeMenu?'selected mg-compact-icon':'mg-compact-icon'} aria-label="Chart styles" title="Chart styles" aria-expanded={chartTypeMenu} onClick={e=>{const chartRoot=root.current;if(chartRoot){const trigger=(e.currentTarget as HTMLElement).getBoundingClientRect();const base=chartRoot.getBoundingClientRect();setChartPopupLeft(Math.max(4,Math.min(trigger.left-base.left,base.width-165)))}setChartTypeMenu(v=>!v);setTimeframeMenu(false);setIndicatorMenu(false);setDrawMenu(false)}}><svg viewBox="0 0 24 24" aria-hidden="true" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M6 3v18M6 7h0M12 2v20M18 4v17"/><rect x="3.5" y="8" width="5" height="8" rx=".8"/><rect x="9.5" y="5" width="5" height="11" rx=".8"/><rect x="15.5" y="10" width="5" height="7" rx=".8"/></svg></button>
    <button type="button" className={indicatorMenu?'selected mg-compact-icon':'mg-compact-icon'} aria-label="Indicators" title="Indicators" aria-expanded={indicatorMenu} onClick={()=>{setIndicatorMenu(v=>!v);setChartTypeMenu(false);setTimeframeMenu(false);setDrawMenu(false)}}><svg viewBox="0 0 24 24" aria-hidden="true" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M3 18h18M5 15l4-5 4 3 6-8"/><path d="M16 5h3v3"/></svg></button>
    
    <button type="button" className={vp?'selected':''} onClick={toggleVP}>Volume Profile</button>

    <button type="button" className={stayDrawing?'selected':''} onClick={toggleStayDrawing}>Keep Tool</button>
    <button type="button" className={objectsOpen?'selected':''} onClick={()=>setObjectsOpen(v=>!v)}>Objects</button>
    <button type="button" className={alertsOpen?'selected':''} onClick={()=>setAlertsOpen(v=>!v)}>Alerts</button>
    <button type="button" className={compareOpen?'selected':''} onClick={()=>setCompareOpen(v=>!v)}>Compare</button>
    <select aria-label="Price scale" value={priceScale} onChange={e=>{const mode=e.target.value as typeof priceScale;try{chart.current?.setPriceScale(mode);setPriceScale(mode)}catch(err){setError(String(err))}}}><option value="linear">Linear</option><option value="logarithmic">Log</option><option value="percentage">Percent</option></select>
    <button type="button" onClick={toggleAllLock}>{allDrawingsLocked?'Unlock All':'Lock All'}</button>
    <button type="button" onClick={toggleAllHidden}>{allDrawingsHidden?'Show All':'Hide All'}</button>
    <div className="mg-toolbar-spacer"/>
    <div className="nx-chart-navigation" aria-label="Chart navigation controls">
     <button type="button" title="Scroll candles left (older history)" aria-label="Scroll left" onClick={()=>{chooseTool(null);chart.current?.scrollLeft(35)}}>‹</button>
     <button type="button" title="Scroll candles right (newer history)" aria-label="Scroll right" onClick={()=>{chooseTool(null);chart.current?.scrollRight(35)}}>›</button>
     <button type="button" title="Zoom into candles" aria-label="Zoom in" onClick={()=>chart.current?.zoomIn(0.8)}>+</button>
     <button type="button" title="Zoom out of candles" aria-label="Zoom out" onClick={()=>chart.current?.zoomOut(1.25)}>−</button>
    </div>
    <button type="button" onClick={()=>chart.current?.goToLive()} title="Go to live price">Live</button>
    <button type="button" onClick={toggleFullscreen}>Fullscreen</button>
    <button type="button" onClick={()=>chart.current?.exportPNG('NEXORA-'+pair.symbol+'.png')} title="Save chart image">Screenshot</button>
    <button type="button" onClick={()=>{if(window.confirm('Clear all drawings for '+pair.symbol+'?')){chart.current?.clearDrawings();save()}}} title="Remove drawings">Clear Drawings</button>
    {chartTypeMenu&&<section className="nexora-mg-popover mg-chart-type-popover" style={{left:chartPopupLeft}} role="menu" aria-label="Chart styles"><div className="mg-chart-style-list">{([{id:'bar',label:'Bars',icon:''},{id:'candlestick',label:'Candles',icon:''},{id:'hollow_candle',label:'Hollow Candles',icon:''},{id:'heikin_ashi',label:'Heikin Ashi',icon:''},{id:'line',label:'Line',icon:''},{id:'area',label:'Area',icon:''},{id:'baseline',label:'Baseline',icon:''},{id:'line_markers',label:'Line with Markers',icon:''},{id:'step_line',label:'Step Line',icon:''},{id:'hlc_area',label:'HLC Area',icon:''},{id:'columns',label:'Columns',icon:''},{id:'high_low',label:'High-Low',icon:''},{id:'renko',label:'Renko',icon:''}] as {id:ChartType|'renko';label:string;icon:string}[]).map(item=><button type="button" role="menuitemradio" aria-checked={kind===item.id} key={item.id} className={kind===item.id?'selected':''} onClick={()=>{try{setChartStyle(item.id)}catch(e){setError(String(e))}}}><span className="mg-style-icon" aria-hidden="true">{item.id==='renko'?<RenkoIcon/>:<StyleIcon kind={item.id}/>}</span><span>{item.label}</span></button>)}</div></section>}
       </div>
   <div className="nexora-mg-stage">
    {timeframeMenu&&<section className="mg-timeframe-menu" role="dialog" aria-label="Timeframe selection"><header><strong>Pinned ({pinned.length}/10)</strong><button className="mg-pin-edit" type="button" onClick={()=>setEditPinned(v=>!v)}>{editPinned?'Done':'Edit'}</button></header><div className="mg-timeframe-grid">{pinned.map(t=><button type="button" key={t} className={t===localFrame?'selected':''} onClick={()=>editPinned?togglePinned(t):changeTimeframe(t)}>{t}{editPinned?' ×':''}</button>)}</div><header><strong>Available</strong><span>{pinned.length>=10?'Maximum 10 pinned':''}</span></header><div className="mg-timeframe-grid">{intervals.filter(t=>!pinned.includes(t)).map(t=><button type="button" key={t} onClick={()=>editPinned?togglePinned(t):changeTimeframe(t)} disabled={editPinned&&pinned.length>=10}>{t}{editPinned?' +':''}</button>)}</div>{editPinned&&<p className="mg-pin-hint">Choose up to 10 shortcuts. Your selection is saved automatically.</p>}</section>}
    <aside className="nexora-mg-rail" aria-label="Drawing toolbar">
 <button type="button" className={!activeTools?'selected':''} title="Crosshair / Cursor" aria-label="Cursor" onClick={()=>chooseTool(null)}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M12 2v20M2 12h20"/></svg></button>
 <button type="button" title="Trend Line" aria-label="Trend Line" className={activeTools==='trend-line'?'selected':''} onClick={()=>chooseTool('trend-line')}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 20L20 4"/><circle cx="4" cy="20" r="2"/><circle cx="20" cy="4" r="2"/></svg></button>
 <button type="button" title="Lines" aria-label="Lines" onClick={()=>setDrawingGroup('Lines')}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 5h20M2 12h20M2 19h20"/><circle cx="8" cy="5" r="2"/><circle cx="16" cy="12" r="2"/></svg></button>
 <button type="button" title="Patterns" aria-label="Patterns" onClick={()=>setDrawingGroup('Patterns')}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 19 8 5l6 10 7-10M3 19l11-4 7 4"/><circle cx="8" cy="5" r="2"/><circle cx="14" cy="15" r="2"/></svg></button>
 <button type="button" title="Fibonacci" aria-label="Fibonacci" onClick={()=>setDrawingGroup('Fibonacci')}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 5h20M2 10h20M2 15h20M2 20h20"/><circle cx="7" cy="10" r="2"/><circle cx="17" cy="15" r="2"/></svg></button>
 <button type="button" title="Brush and Shapes" aria-label="Brush and Shapes" onClick={()=>setDrawingGroup('Shapes & Text')}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 19c6 2 7-5 11-11l5-5 2 2-5 5C10 14 11 21 3 19Z"/></svg></button>
 <button type="button" title="Text" aria-label="Text" className={activeTools==='text'?'selected':''} onClick={()=>chooseTool('text')}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 5h18M12 5v15M7 20h10"/></svg></button>
 <button type="button" title="Ruler / Measure price and time" aria-label="Ruler" className={activeTools==='date-price-range'?'selected':''} onClick={()=>chooseTool('date-price-range')}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><g transform="rotate(-45 12 12)"><rect x="3" y="8" width="18" height="8" rx="1"/><path d="M6 8v4M9 8v3M12 8v4M15 8v3M18 8v4"/></g></svg></button>
 <button type="button" title="Long / Short and Measurement" aria-label="Trading and measuring tools" onClick={()=>setDrawingGroup('Trading & Measure')}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M5 5h14v14H5zM5 12h14M12 5v14"/></svg></button>
 <button type="button" title="All Drawing Tools" aria-label="All Drawing Tools" className={drawingGroup==='All tools'?'selected':''} onClick={()=>{setRailSearch('');setDrawingGroup(v=>v==='All tools'?null:'All tools')}}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 6h16M4 12h16M4 18h16"/><circle cx="9" cy="6" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="7" cy="18" r="2"/></svg></button>
 <button type="button" title="Magnet" aria-label="Toggle Magnet" className={magnet?'selected':''} onClick={toggleMagnet}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M5 12V7a7 7 0 0 1 14 0v5h-5V7a2 2 0 0 0-4 0v5z"/></svg></button>
 <button type="button" title="Lock All Drawings" aria-label="Lock All Drawings" onClick={toggleAllLock}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg></button>
 <button type="button" title="Show / Hide Drawings" aria-label="Show or Hide Drawings" onClick={toggleAllHidden}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg></button>
 <div className="mg-rail-spacer"/>
 <button type="button" className="mg-rail-trash" title="Delete all drawings" aria-label="Delete all drawings" onClick={()=>{if(window.confirm('Delete all drawings for '+pair.symbol+'?')){chart.current?.clearDrawings();save()}}}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6M14 11v6"/></svg></button>
 </aside>
    <div className="nexora-mg-render" ref={holder}/>
    {drawMenu&&<section className="nexora-mg-popover mg-draw-popover" role="dialog" aria-label="Drawing Tools"><header><strong>Drawing Tools</strong><button type="button" aria-label="Close drawing tools" onClick={()=>setDrawMenu(false)}>×</button></header><input aria-label="Search drawing tools" value={drawSearch} placeholder="Search drawing tools..." onChange={e=>setDrawSearch(e.target.value)}/><div className="nexora-mg-options"><button type="button" onClick={()=>chooseTool(null)}>Cursor / Cancel tool</button>{drawingGroups.map(g=><div key={g.label}><h4>{g.label}</h4>{g.tools.filter(([,label])=>label.toLowerCase().includes(drawSearch.toLowerCase())).map(([id,label])=><button type="button" key={id} className={activeTools===id?'selected':''} onClick={()=>chooseTool(id)}>{label}</button>)}</div>)}</div></section>}
    {alertsOpen&&<section className="nexora-mg-objects"><header><strong>Price Alerts</strong><button onClick={()=>setAlertsOpen(false)}>×</button></header><div className="mg-sidebar-form"><input aria-label="Alert price" type="number" min="0" step="any" placeholder="Alert price" value={alertPrice} onChange={e=>setAlertPrice(e.target.value)}/><button onClick={addAlert}>Add alert</button></div><div className="nexora-mg-options">{alerts.map(a=><div key={a.id} className="mg-object-row"><span>{a.price}</span><button onClick={()=>removeAlert(a.id)}>Remove</button></div>)}</div></section>}
    {compareOpen&&<section className="nexora-mg-objects"><header><strong>Compare Markets</strong><button onClick={()=>setCompareOpen(false)}>×</button></header><div className="mg-sidebar-form"><input aria-label="Compare market symbol" placeholder="ETHUSDT" value={compareSymbol} onChange={e=>setCompareSymbol(e.target.value)}/><button onClick={addCompare}>Compare</button></div><div className="nexora-mg-options">{compared.map(symbol=><div key={symbol} className="mg-object-row"><span>{symbol}</span><button onClick={()=>removeCompare(symbol)}>Remove</button></div>)}</div></section>}
    {objectsOpen&&<section className="nexora-mg-objects"><header><strong>Objects ({items.length})</strong><button onClick={()=>setObjectsOpen(false)}>×</button></header>{selectedDrawing&&<div className="mg-sidebar-form mg-drawing-style"><label>Color <input type="color" value={drawingColor} onChange={e=>{setDrawingColor(e.target.value);changeDrawingAppearance('color',e.target.value)}}/></label><label>Width <input type="number" min="1" max="12" value={drawingWidth} onChange={e=>{const n=Number(e.target.value);setDrawingWidth(n);changeDrawingAppearance('lineWidth',n)}}/></label></div>}<div className="nexora-mg-options">{items.length===0?<p>No drawings yet</p>:items.map((d,index)=><div className="mg-object-row" key={d.id||index}><button className={selectedDrawing===d.id?'selected':''} title="Select drawing" onClick={()=>setSelectedDrawing(d.id)}>{d.toolName||'Drawing'} #{index+1}</button><div><button title="Show/hide" onClick={()=>drawingAction(d.id,'visible')}>◉</button><button title="Lock/unlock" onClick={()=>drawingAction(d.id,'lock')}>♧</button><button title="Bring forward" onClick={()=>drawingAction(d.id,'front')}>↑</button><button title="Send backward" onClick={()=>drawingAction(d.id,'back')}>↓</button><button title="Delete" onClick={()=>drawingAction(d.id,'remove')}>×</button></div></div>)}</div></section>}
    {error&&<div className="nexora-mg-error" role="alert">{error}<button onClick={()=>setError(null)}>Dismiss</button></div>}
    {indicatorMenu&&<section className="nexora-mg-popover mg-indicator-popover"><header><strong>Indicators</strong><button onClick={()=>setIndicatorMenu(false)}>×</button></header><input value={indSearch} placeholder="Search indicators..." onChange={e=>setIndSearch(e.target.value)}/><div className="nexora-mg-options">{indicatorList.filter(i=>i.label.toLowerCase().includes(indSearch.toLowerCase())||i.key.toLowerCase().includes(indSearch.toLowerCase())).sort((a,b)=>Number(favorites.includes(b.key))-Number(favorites.includes(a.key))).map(i=><div className="mg-indicator-row" key={i.key}><button title="Favorite" onClick={()=>toggleFavorite(i.key)}>{favorites.includes(i.key)?'★':'☆'}</button><button className={chosen.includes(i.key)?'selected':''} onClick={()=>toggleIndicator(i.key)}><span>{i.label}</span><span>{chosen.includes(i.key)?'✓':'+'}</span></button><button title="Settings" onClick={()=>setSettingsOpen(i.key)}>⚙</button></div>)}</div></section>}
    {settingsOpen&&<section className="nexora-mg-popover mg-settings-popover"><header><strong>{indicatorList.find(i=>i.key===settingsOpen)?.label} Settings</strong><button onClick={()=>setSettingsOpen(null)}>×</button></header><form onSubmit={e=>{e.preventDefault();const fd=new FormData(e.currentTarget);const values:Record<string,number>={};for(const [k,v] of fd){const n=Number(v);if(Number.isFinite(n))values[k]=n}applyParams(settingsOpen,values)}}>{Object.entries(params[settingsOpen]||{period:settingsOpen==='EMA'?50:14}).map(([k,v])=><label key={k}>{k}<input name={k} type="number" step="any" defaultValue={v} required/></label>)}<button type="submit">Apply</button></form></section>}
    {drawingGroup&&<section className="mg-rail-flyout" role="menu" aria-label={drawingGroup}><header><strong>{drawingGroup}</strong><button type="button" aria-label="Close drawing menu" onClick={()=>setDrawingGroup(null)}>×</button></header><input className="mg-rail-search" aria-label="Search drawing tools" placeholder="Search tools..." value={railSearch} onChange={e=>setRailSearch(e.target.value)}/><div className="mg-rail-flyout-items">{(drawingGroup==='All tools'?drawingGroups:drawingGroups.filter(g=>g.label===drawingGroup)).map(g=><div key={g.label}><h4>{g.label}</h4>{g.tools.filter(([,label])=>label.toLowerCase().includes(railSearch.toLowerCase())).map(([id,label])=><button type="button" role="menuitem" className={activeTools===id?'selected':''} key={id} onClick={()=>chooseTool(id)}>{label}</button>)}</div>)}</div><div className="mg-rail-actions"><button type="button" onClick={()=>{chart.current?.lockAllDrawings();setDrawingGroup(null)}}>Lock all</button><button type="button" onClick={()=>{chart.current?.hideAllDrawings();setDrawingGroup(null)}}>Hide all</button><button type="button" onClick={()=>{if(window.confirm('Clear all drawings?')){chart.current?.clearDrawings();save()}setDrawingGroup(null)}}>Clear</button></div></section>}
   </div>
 </div>
}
