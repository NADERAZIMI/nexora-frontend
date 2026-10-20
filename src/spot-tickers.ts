import {useEffect,useMemo,useState} from 'react';
import type {SpotPair} from './spot-markets';
export type MarketTicker={lastPrice:number;change:number;turnover:number;high?:number;low?:number;volume?:number};
type RawTicker={symbol?:string;lastPrice?:string;price24hPcnt?:string;highPrice24h?:string;lowPrice24h?:string;volume24h?:string;turnover24h?:string};
const MAX_PER_SOCKET=110;
const MAX_PER_SUBSCRIBE=10;
/** Bybit's public Spot tickers; subscriptions and updates, never a polling loop. */
export function useSpotTickers(pairs:SpotPair[]){
 const names=useMemo(()=>[...new Set(pairs.map(p=>p.symbol).filter(s=>/^[A-Z0-9]{3,30}$/.test(s)))].sort(),[pairs]);
 const signature=names.join(',');
 const [tickers,setTickers]=useState<Record<string,MarketTicker>>({});
 const [ready,setReady]=useState(false);
 useEffect(()=>{
  let disposed=false;
  const sockets:WebSocket[]=[];
  const timers:ReturnType<typeof setTimeout>[]=[];
  const heartbeats:ReturnType<typeof setInterval>[]=[];
  const symbols=signature.split(',').filter(Boolean);
  setTickers({});setReady(false);
  const chunks:string[][]=[];
  for(let i=0;i<symbols.length;i+=MAX_PER_SOCKET)chunks.push(symbols.slice(i,i+MAX_PER_SOCKET));
  for(const group of chunks){
   let retries=0;
   const open=()=>{
    if(disposed)return;
    const ws=new WebSocket('wss://stream.bybit.com/v5/public/spot');sockets.push(ws);
    ws.onopen=()=>{
     if(disposed)return;
     retries=0;
     for(let i=0;i<group.length;i+=MAX_PER_SUBSCRIBE){
      const args=group.slice(i,i+MAX_PER_SUBSCRIBE).map(x=>'tickers.'+x);
      const timer=setTimeout(()=>{if(!disposed&&ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify({op:'subscribe',args}));},Math.floor(i/MAX_PER_SUBSCRIBE)*750);
      timers.push(timer);
     }
     heartbeats.push(setInterval(()=>{if(!disposed&&ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify({op:'ping'}));},20000));
    };
    ws.onmessage=event=>{
     if(disposed)return;
     try{
      const packet=JSON.parse(String(event.data)) as {topic?:string;data?:RawTicker};
      const d=packet.data;
      if(!packet.topic?.startsWith('tickers.')||!d||!d.symbol||packet.topic!=='tickers.'+d.symbol||!group.includes(d.symbol))return;
      const symbol=d.symbol;
      setTickers(prev=>{
       const old=prev[symbol];
       const parse=(value:string|undefined,fallback:number|undefined):number|undefined=>{
        if(value===undefined)return fallback;
        const n=Number(value);return Number.isFinite(n)?n:fallback;
       };
       const lastPrice=parse(d.lastPrice,old?.lastPrice),change=parse(d.price24hPcnt,old?.change),turnover=parse(d.turnover24h,old?.turnover);
       if(lastPrice===undefined||lastPrice<=0||change===undefined||turnover===undefined)return prev;
       return {...prev,[symbol]:{lastPrice,change,turnover,high:parse(d.highPrice24h,old?.high),low:parse(d.lowPrice24h,old?.low),volume:parse(d.volume24h,old?.volume)}};
      });
      setReady(true);
     }catch{/* Ignore invalid external frames. */}
    };
    ws.onerror=()=>{/* onclose schedules recovery */};
    ws.onclose=()=>{
     if(disposed)return;
     const delay=Math.min(30000,1000*2**Math.min(5,retries++));
     timers.push(setTimeout(open,delay));
    };
   };
   open();
  }
  return()=>{disposed=true;for(const t of timers)clearTimeout(t);for(const t of heartbeats)clearInterval(t);for(const ws of sockets){ws.onclose=null;ws.close();}};
 },[signature]);
 return {tickers,ready};
}
