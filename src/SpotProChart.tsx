import {useEffect,useRef,useState} from 'react';
import type {KLineChartPro} from '@klinecharts/pro';
import '@klinecharts/pro/dist/klinecharts-pro.css';
import type {SpotPair} from './spot-markets';
import './SpotProChart.css';

type Period={multiplier:number;timespan:string;text:string};
type SymbolInfo={ticker:string;name?:string;shortName?:string;exchange?:string;market?:string;priceCurrency?:string;type?:string};
type Candle={timestamp:number;open:number;high:number;low:number;close:number;volume:number;turnover:number};
const periods:Period[]=[{multiplier:1,timespan:'minute',text:'1m'},{multiplier:5,timespan:'minute',text:'5m'},{multiplier:15,timespan:'minute',text:'15m'},{multiplier:30,timespan:'minute',text:'30m'},{multiplier:1,timespan:'hour',text:'1h'},{multiplier:4,timespan:'hour',text:'4h'},{multiplier:1,timespan:'day',text:'1D'},{multiplier:1,timespan:'week',text:'1W'}];
const interval=(p:Period)=>p.timespan==='minute'?String(p.multiplier):p.timespan==='hour'?String(p.multiplier*60):p.timespan==='day'?'D':p.timespan==='week'?'W':'M';
const symbolInfo=(pair:SpotPair):SymbolInfo=>({ticker:pair.symbol,name:pair.base+'/'+pair.quote,shortName:pair.base+'/'+pair.quote,exchange:'Bybit',market:'crypto',priceCurrency:pair.quote,type:'spot'});
const validSymbol=(s:string)=>/^[A-Z0-9]{2,32}$/.test(s);
const finite=(c:Candle)=>Object.values(c).every(Number.isFinite)&&c.timestamp>0&&c.open>0&&c.high>=c.low&&c.low>0&&c.close>0&&c.volume>=0;
function candle(raw:unknown):Candle|null{
 if(!Array.isArray(raw)||raw.length<7)return null;
 const c={timestamp:Number(raw[0]),open:Number(raw[1]),high:Number(raw[2]),low:Number(raw[3]),close:Number(raw[4]),volume:Number(raw[5]),turnover:Number(raw[6])};
 return finite(c)?c:null;
}
class BybitChartDatafeed{
 private sockets=new Map<string,WebSocket>();
 private closed=false;
 constructor(private pairs:SpotPair[]){}
 searchSymbols(search=''):Promise<SymbolInfo[]>{
  const q=search.toUpperCase().trim();
  return Promise.resolve(this.pairs.filter(p=>p.symbol.includes(q)).slice(0,80).map(symbolInfo));
 }
 async getHistoryKLineData(symbol:SymbolInfo,period:Period,from:number,to:number):Promise<Candle[]>{
  if(this.closed||!validSymbol(symbol.ticker))return [];
  const query=new URLSearchParams({category:'spot',symbol:symbol.ticker,interval:interval(period),limit:'500'});
  const end=to>0?(to<1e11?to*1000:to):0;
  const start=from>0?(from<1e11?from*1000:from):0;
  if(end>0)query.set('end',String(Math.floor(end)));
  if(start>0&&start<end)query.set('start',String(Math.floor(start)));
  // Pro v0.1.1 does not catch datafeed errors and otherwise leaves its loader spinning forever.
  // Bound the initial request and return an empty verified dataset on network failure.
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),6500);
  try{
   const response=await fetch('https://api.bybit.com/v5/market/kline?'+query.toString(),{signal:controller.signal});
   if(!response.ok)return [];
   const data=await response.json() as {retCode?:number;result?:{list?:unknown[]}};
   if(data.retCode!==0||!Array.isArray(data.result?.list))return [];
   return data.result.list.map(candle).filter((c):c is Candle=>c!==null).sort((a,b)=>a.timestamp-b.timestamp);
  }catch{return []}finally{clearTimeout(timeout)}
 }
 subscribe(symbol:SymbolInfo,period:Period,callback:(c:Candle)=>void){
  if(this.closed||!validSymbol(symbol.ticker))return;
  this.unsubscribe(symbol,period);
  const key=symbol.ticker+'/'+interval(period);
  const topic='kline.'+interval(period)+'.'+symbol.ticker;
  const ws=new WebSocket('wss://stream.bybit.com/v5/public/spot');
  this.sockets.set(key,ws);
  ws.onopen=()=>ws.send(JSON.stringify({op:'subscribe',args:[topic]}));
  ws.onmessage=e=>{
   if(this.closed)return;
   try{
    const message=JSON.parse(e.data) as {topic?:string;data?:Array<{start:number;open:string;high:string;low:string;close:string;volume:string;turnover:string}>};
    if(message.topic!==topic||!Array.isArray(message.data))return;
    for(const d of message.data){
     const c=candle([d.start,d.open,d.high,d.low,d.close,d.volume,d.turnover]);
     if(c)callback(c);
    }
   }catch{/* invalid stream message */}
  };
  ws.onclose=()=>{if(this.sockets.get(key)===ws)this.sockets.delete(key)};
 }
 unsubscribe(symbol:SymbolInfo,period:Period){
  const key=symbol.ticker+'/'+interval(period);const ws=this.sockets.get(key);
  if(ws){this.sockets.delete(key);ws.onclose=null;ws.close()}
 }
 dispose(){this.closed=true;for(const ws of this.sockets.values()){ws.onclose=null;ws.close()}this.sockets.clear()}
}
export default function SpotProChart({pair,frame}:{pair:SpotPair;frame:string}){
 const container=useRef<HTMLDivElement>(null);
 const [error,setError]=useState<string|null>(null);
 useEffect(()=>{
  const node=container.current;if(!node)return;
  let chart:KLineChartPro|null=null;
  let disposed=false;
  const datafeed=new BybitChartDatafeed([pair]);
  const init=async()=>{try{
   const {KLineChartPro}=await import('@klinecharts/pro');
   if(disposed)return;
   const period=periods.find(p=>p.text.toLowerCase()===frame.toLowerCase())||periods[4];
   chart=new KLineChartPro({container:node,symbol:symbolInfo(pair),period,periods,datafeed,theme:document.documentElement.dataset.nxTheme==='light'?'light':'dark',locale:'en-US',timezone:'Etc/UTC',watermark:'NEXORA',drawingBarVisible:true,mainIndicators:['MA'],subIndicators:['VOL']});
   setError(null);
  }catch(e){if(!disposed)setError(e instanceof Error?e.message:'Chart could not initialize')}};
  void init();
  const obs=new MutationObserver(()=>{try{chart?.setTheme(document.documentElement.dataset.nxTheme==='light'?'light':'dark')}catch{/* chart already unmounted */}});
  obs.observe(document.documentElement,{attributes:true,attributeFilter:['data-nx-theme']});
  return()=>{disposed=true;obs.disconnect();datafeed.dispose();node.replaceChildren();chart=null};
 },[pair.symbol,frame]);
 return <div className="nexora-pro-chart">{error&&<div className="nexora-chart-error" role="alert">{error}</div>}<div ref={container} className="nexora-pro-chart-container"/></div>;
}
