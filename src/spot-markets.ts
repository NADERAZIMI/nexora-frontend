import {useEffect,useMemo,useState} from 'react';
export type SpotPair={symbol:string;base:string;quote:string};
const FALLBACK:SpotPair[]=[['BTC','USDT'],['ETH','USDT'],['SOL','USDT'],['XRP','USDT'],['DOGE','USDT'],['ADA','USDT'],['LINK','USDT'],['AVAX','USDT'],['DOT','USDT'],['LTC','USDT'],['BCH','USDT'],['TRX','USDT'],['SUI','USDT'],['TON','USDT'],['SHIB','USDT'],['PEPE','USDT']].map(([base,quote])=>({symbol:base+quote,base,quote}));
type Response={retCode?:number;result?:{list?:Array<{symbol?:string;baseCoin?:string;quoteCoin?:string;status?:string}>;nextPageCursor?:string}};
export function useSpotMarkets(){
 const [pairs,setPairs]=useState<SpotPair[]>(FALLBACK);
 const [source,setSource]=useState<'loading'|'live'|'fallback'>('loading');
 useEffect(()=>{
  const abort=new AbortController();
  const run=async()=>{
   // Use the full Bybit catalog saved with the frontend release, avoiding browser CORS.
   try{
    const response=await fetch('/spot-markets.json',{signal:abort.signal,cache:'no-store'});
    if(response.ok){
     const data=await response.json() as {source?:string;pairs?:SpotPair[]};
     if(data.source==='bybit-public-spot'&&Array.isArray(data.pairs)&&data.pairs.length>=100){
      setPairs(data.pairs);setSource('live');return;
     }
    }
   }catch{if(abort.signal.aborted)return;}
   const hosts=['/bybit-public/v5/market/instruments-info','https://api.bybit.com/v5/market/instruments-info','https://api.bytick.com/v5/market/instruments-info'];
   let loaded:SpotPair[]=[];
   for(const host of hosts){
    try{
     let cursor='';const all:SpotPair[]=[];let pages=0;
     do{
      const qs=new URLSearchParams({category:'spot'});
      const response=await fetch(host+'?'+qs,{signal:abort.signal,cache:'no-store',credentials:'omit'});
      if(!response.ok)throw Error('HTTP '+response.status);
      const json=await response.json() as Response;
      if(json.retCode!==0||!Array.isArray(json.result?.list))throw Error('Invalid catalog');
      for(const item of json.result.list){
       if(!item.symbol||!item.baseCoin||!item.quoteCoin||item.status!=='Trading')continue;
       if(!/^[A-Z0-9]{3,32}$/.test(item.symbol))continue;
       all.push({symbol:item.symbol,base:item.baseCoin,quote:item.quoteCoin});
      }
      cursor='';
      pages++;
     }while(cursor&&pages<12);
     if(all.length<20)throw Error('Incomplete catalog');
     loaded=all;break;
    }catch(e){if(abort.signal.aborted)return;}
   }
   if(abort.signal.aborted)return;
   if(loaded.length){setPairs([...new Map(loaded.map(x=>[x.symbol,x])).values()].sort((a,b)=>a.symbol.localeCompare(b.symbol)));setSource('live');}
   else setSource('fallback');
  };void run();return()=>abort.abort();
 },[]);
 return {pairs,source};
}
export function useFilteredPairs(pairs:SpotPair[],term:string){
 return useMemo(()=>{const q=term.trim().toUpperCase().replace('/','');return pairs.filter(p=>p.symbol.includes(q)||p.base.includes(q)||p.quote.includes(q)).sort((a,b)=>Number(b.quote==='USDT')-Number(a.quote==='USDT')||a.symbol.localeCompare(b.symbol));},[pairs,term]);
}
