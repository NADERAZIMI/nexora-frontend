import {useEffect,useState} from 'react';
export type MarketTicker={lastPrice:number;change:number;turnover:number;high?:number;low?:number;volume?:number};
type Payload={source?:string;updatedAt?:number;tickers?:Record<string,MarketTicker>};
export function useSpotTickers(){
 const [tickers,setTickers]=useState<Record<string,MarketTicker>>({});
 const [ready,setReady]=useState(false);
 useEffect(()=>{
  let alive=true;
  const load=async()=>{
   try{
    // This JSON is refreshed on the Turkey VPS, not requested cross-origin.
    const response=await fetch('/spot-tickers.json',{cache:'no-store',credentials:'omit'});
    if(!response.ok)throw Error('HTTP '+response.status);
    const data=await response.json() as Payload;
    if(data.source!=='bybit-public-spot'||!data.tickers||Object.keys(data.tickers).length<100)throw Error('Invalid ticker cache');
    // Never present an old cached ticker snapshot as current prices.
    if(!data.updatedAt||Date.now()-data.updatedAt>180000)throw Error('Stale ticker cache');
    if(alive){setTickers(data.tickers);setReady(true);}
   }catch{if(alive){setReady(false);setTickers({});}}
  };
  void load();
  const timer=window.setInterval(()=>void load(),30000);
  return()=>{alive=false;clearInterval(timer);};
 },[]);
 return {tickers,ready};
}
